const $=id=>document.getElementById(id);
let state={front:null,back:null,identification:null,card:null,ocr:""};

function preview(input,img){
  const f=input.files[0]; if(!f)return;
  const url=URL.createObjectURL(f); img.src=url; img.hidden=false;
  return f;
}
$("front").addEventListener("change",()=>{
  state.front=preview($("front"),$("frontPreview"));
  checkReady();
});

$("back").addEventListener("change",()=>{
  state.back=preview($("back"),$("backPreview"));
  checkReady();
});

$("identification").addEventListener("change",()=>{
  state.identification=preview(
    $("identification"),
    $("identificationPreview")
  );
  checkReady();
});

function checkReady(){
  $("process").disabled=!(
    state.front &&
    state.back &&
    state.identification
  );
}

$("process").onclick=async()=>{

  $("analysis").hidden=false;
  $("status").textContent="Détection de la carte et recadrage…";

  try{

    const blob=await cropIdentificationRegion(state.identification);

    const url=URL.createObjectURL(blob);

    const img=new Image();

    img.onload=()=>{

      const canvas=$("frontCanvas");

      canvas.width=img.naturalWidth;
      canvas.height=img.naturalHeight;

      canvas.hidden=false;

      const ctx=canvas.getContext("2d");

      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      ctx.drawImage(
        img,
        0,
        0
      );

      URL.revokeObjectURL(url);
    };

    img.src=url;

    $("status").innerHTML=
      '<div class="ok">Recadrage automatique effectué. Vérifiez visuellement la zone détectée.</div>';

  }catch(e){

    console.error(e);

    $("status").innerHTML=
      '<div class="warn">Impossible de détecter automatiquement la zone de la carte.</div>';

  }

};

async function cropIdentificationRegion(file){

  const img = new Image();
  img.src = URL.createObjectURL(file);

  await new Promise((resolve,reject)=>{
    img.onload=resolve;
    img.onerror=reject;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(img,0,0);

  const src = cv.imread(canvas);

  // Réduction de taille pour accélérer OpenCV
  const maxWidth = 1200;
  const scale = Math.min(1,maxWidth/src.cols);

  let work = src;

  if(scale < 1){
    work = new cv.Mat();
    cv.resize(
      src,
      work,
      new cv.Size(
        Math.round(src.cols*scale),
        Math.round(src.rows*scale)
      )
    );
  }

  // Passage en niveaux de gris
  const gray = new cv.Mat();
  cv.cvtColor(work,gray,cv.COLOR_RGBA2GRAY);

  // Réduction du bruit
  const blurred = new cv.Mat();
  cv.GaussianBlur(
    gray,
    blurred,
    new cv.Size(5,5),
    0
  );

  // Détection des contours
  const edges = new cv.Mat();

  cv.Canny(
    blurred,
    edges,
    50,
    150
  );

  // Recherche des contours
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  cv.findContours(
    edges,
    contours,
    hierarchy,
    cv.RETR_EXTERNAL,
    cv.CHAIN_APPROX_SIMPLE
  );

  let best = null;
  let bestArea = 0;

  for(let i=0;i<contours.size();i++){

    const contour = contours.get(i);
    const rect = cv.boundingRect(contour);

    const area = rect.width * rect.height;

    if(area > bestArea &&
       rect.width > work.cols*0.25 &&
       rect.height > work.rows*0.25){

      bestArea = area;
      best = rect;
    }

    contour.delete();
  }

  let cropX;
  let cropY;
  let cropW;
  let cropH;

  if(best){

    // Zone inférieure gauche de la zone détectée
    cropW = Math.round(best.width * 0.55);
    cropH = Math.round(best.height * 0.30);

    cropX = best.x;
    cropY = best.y + best.height - cropH;

  }else{

    // Solution de secours si la carte n'est pas détectée
    cropW = Math.round(work.cols * 0.65);
    cropH = Math.round(work.rows * 0.35);

    cropX = 0;
    cropY = work.rows - cropH;
  }

  const rect = new cv.Rect(
    Math.max(0,cropX),
    Math.max(0,cropY),
    Math.min(cropW,work.cols-cropX),
    Math.min(cropH,work.rows-cropY)
  );

  const cropped = work.roi(rect);

  // Agrandissement pour l'OCR
  const output = new cv.Mat();

  cv.resize(
    cropped,
    output,
    new cv.Size(
      cropped.cols*3,
      cropped.rows*3
    ),
    0,
    0,
    cv.INTER_CUBIC
  );

  const resultCanvas = document.createElement("canvas");

  cv.imshow(resultCanvas,output);

  const blob = await new Promise(resolve=>{
    resultCanvas.toBlob(
      resolve,
      "image/png"
    );
  });

  // Nettoyage mémoire OpenCV
  src.delete();
  if(work !== src) work.delete();
  gray.delete();
  blurred.delete();
  edges.delete();
  contours.delete();
  hierarchy.delete();
  cropped.delete();
  output.delete();

  URL.revokeObjectURL(img.src);

  return blob;
}
async function detectCardEdges(file){

  const img = new Image();

  img.src = URL.createObjectURL(file);

  await new Promise((resolve,reject)=>{
    img.onload=resolve;
    img.onerror=reject;
  });

  const canvas = document.createElement("canvas");

  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext("2d");

  ctx.drawImage(
    img,
    0,
    0
  );

  const src = cv.imread(canvas);

  // Réduction éventuelle de l'image
  const maxWidth = 1600;

  const scale = Math.min(
    1,
    maxWidth / src.cols
  );

  let work;

  if(scale < 1){

    work = new cv.Mat();

    cv.resize(
      src,
      work,
      new cv.Size(
        Math.round(src.cols * scale),
        Math.round(src.rows * scale)
      )
    );

  }else{

    work = src.clone();

  }

  // Niveaux de gris
  const gray = new cv.Mat();

  cv.cvtColor(
    work,
    gray,
    cv.COLOR_RGBA2GRAY
  );

  // Réduction du bruit
  const blurred = new cv.Mat();

  cv.GaussianBlur(
    gray,
    blurred,
    new cv.Size(5,5),
    0
  );

  // Détection des contours
  const edges = new cv.Mat();

  cv.Canny(
    blurred,
    edges,
    40,
    120
  );

  // Détection des lignes
  const lines = new cv.Mat();

  cv.HoughLinesP(
    edges,
    lines,
    1,
    Math.PI / 180,
    60,
    Math.min(work.cols,work.rows) * 0.15,
    25
  );

  let leftLine = null;
  let bottomLine = null;

  let leftScore = 0;
  let bottomScore = 0;

  for(let i=0;i<lines.rows;i++){

    const x1 = lines.data32S[i*4];
    const y1 = lines.data32S[i*4+1];

    const x2 = lines.data32S[i*4+2];
    const y2 = lines.data32S[i*4+3];

    const dx = x2-x1;
    const dy = y2-y1;

    const length = Math.sqrt(
      dx*dx + dy*dy
    );

    if(length < work.cols * 0.12){
      continue;
    }

    const angle =
      Math.atan2(
        Math.abs(dy),
        Math.abs(dx)
      ) * 180 / Math.PI;

    const avgX = (x1+x2)/2;
    const avgY = (y1+y2)/2;

    // Ligne presque verticale = candidat bord gauche
    if(angle > 75 && avgX < work.cols * 0.65){

      const score =
        length *
        (1 + (1-avgX/work.cols));

      if(score > leftScore){

        leftScore = score;

        leftLine = {
          x1,
          y1,
          x2,
          y2
        };
      }
    }

    // Ligne presque horizontale = candidat bord inférieur
    if(angle < 15 && avgY > work.rows * 0.30){

      const score =
        length *
        (1 + avgY/work.rows);

      if(score > bottomScore){

        bottomScore = score;

        bottomLine = {
          x1,
          y1,
          x2,
          y2
        };
      }
    }
  }

  // Création de l'image de contrôle
  const debugCanvas = document.createElement("canvas");

  debugCanvas.width = work.cols;
  debugCanvas.height = work.rows;

  cv.imshow(
    debugCanvas,
    work
  );

  const debugCtx =
    debugCanvas.getContext("2d");

  debugCtx.lineWidth = 8;

  // Rouge = bord gauche détecté
  if(leftLine){

    debugCtx.strokeStyle = "red";

    debugCtx.beginPath();

    debugCtx.moveTo(
      leftLine.x1,
      leftLine.y1
    );

    debugCtx.lineTo(
      leftLine.x2,
      leftLine.y2
    );

    debugCtx.stroke();
  }

  // Bleu = bord inférieur détecté
  if(bottomLine){

    debugCtx.strokeStyle = "blue";

    debugCtx.beginPath();

    debugCtx.moveTo(
      bottomLine.x1,
      bottomLine.y1
    );

    debugCtx.lineTo(
      bottomLine.x2,
      bottomLine.y2
    );

    debugCtx.stroke();
  }

  const resultBlob =
    await new Promise(resolve=>{

      debugCanvas.toBlob(
        resolve,
        "image/png"
      );

    });

  // Nettoyage
  src.delete();
  work.delete();
  gray.delete();
  blurred.delete();
  edges.delete();
  lines.delete();

  URL.revokeObjectURL(img.src);

  return resultBlob;
}

async function ocrImage(file){

  const img = new Image();

  img.src = URL.createObjectURL(file);

  await new Promise((resolve,reject)=>{
    img.onload=resolve;
    img.onerror=reject;
  });

  const scale = 3;

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth * scale;
  canvas.height = img.naturalHeight * scale;

  const ctx = canvas.getContext("2d");

  ctx.drawImage(
    img,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const imageData = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );

  const data = imageData.data;

  // Passage en niveaux de gris + amélioration du contraste
  for(let i=0;i<data.length;i+=4){

    const gray =
      0.299 * data[i] +
      0.587 * data[i+1] +
      0.114 * data[i+2];

    const contrast =
      Math.max(0,Math.min(255,
        ((gray - 128) * 1.8) + 128
      ));

    data[i] = contrast;
    data[i+1] = contrast;
    data[i+2] = contrast;
  }

  ctx.putImageData(imageData,0,0);

  const processedBlob = await new Promise(resolve=>{
    canvas.toBlob(resolve,"image/png");
  });

  const worker = await Tesseract.createWorker("fra");

  const result = await worker.recognize(processedBlob);

  await worker.terminate();

  URL.revokeObjectURL(img.src);

  return result.data.text || "";
}
function extractLocalId(text){

  if(!text) return "";

  /*
   * Recherche des formats classiques de numéros Pokémon :
   * 006/165
   * 006 / 165
   * 006-165
   * 006 sur 165
   */

  const normalized=text
    .replace(/[Oo]/g,"0")
    .replace(/[Il]/g,"1")
    .replace(/\s+/g," ");

  let match=normalized.match(/\b(\d{1,3})\s*[\/\-]\s*(\d{1,3})\b/);

  if(match){
    return `${match[1].padStart(3,"0")}/${match[2]}`;
  }

  match=normalized.match(/\b(\d{1,3})\s+(?:sur|of)\s+(\d{1,3})\b/i);

  if(match){
    return `${match[1].padStart(3,"0")}/${match[2]}`;
  }

  return "";
} 
$("process").onclick=async()=>{

  $("analysis").hidden=false;

  $("status").textContent=
    "Détection des bords de la carte…";

  try{

    const blob =
      await detectCardEdges(
        state.identification
      );

    const url =
      URL.createObjectURL(blob);

    const img =
      new Image();

    img.onload=()=>{

      const canvas =
        $("frontCanvas");

      canvas.width =
        img.naturalWidth;

      canvas.height =
        img.naturalHeight;

      canvas.hidden=false;

      const ctx =
        canvas.getContext("2d");

      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      ctx.drawImage(
        img,
        0,
        0
      );

      URL.revokeObjectURL(url);

    };

    img.src=url;

    $("status").innerHTML=
      '<div class="ok">Détection effectuée. Rouge = bord gauche ; bleu = bord inférieur.</div>';

  }catch(e){

    console.error(e);

    $("status").innerHTML=
      '<div class="warn">Erreur pendant la détection de la carte.</div>';

  }

}; 
function renderMatches(cards){
  if(!cards.length){
    $("matches").innerHTML='<div class="warn">Aucune correspondance. Saisissez manuellement le nom et le numéro.</div>';
    return;
  }

  $("matches").innerHTML="";

  cards.forEach(c=>{
    const div=document.createElement("div");
    div.className="match";

    const img=document.createElement("img");
    img.alt=c.name||"";
    img.loading="lazy";

    // TCGdex fournit généralement le chemin d'image via /cards/{id}
    // On construit l'URL d'image à partir de l'identifiant de la carte.
    if(c.id){
img.src=`${c.image}/high.webp`;
    }

    const info=document.createElement("div");
    info.innerHTML=`
      <b>${esc(c.name)}</b><br>
      <span>${esc(c.localId||"")}</span><br>
      <button>Utiliser</button>
    `;

    div.appendChild(img);
    div.appendChild(info);

    info.querySelector("button").onclick=()=>selectCard(c);

    $("matches").appendChild(div);
  });
}
async function selectCard(c){
  $("status").textContent="Chargement des détails…";
  try{
    const r=await fetch("https://api.tcgdex.net/v2/fr/cards/"+encodeURIComponent(c.id));
    const d=await r.json(); state.card=d;
    $("title").value=`${d.name||c.name} ${d.localId||c.localId} ${d.set?.name||""} FR Pokémon`.replace(/\s+/g," ").trim();
    $("description").value=`Carte Pokémon ${d.name||c.name} ${d.localId||c.localId} de l’extension ${d.set?.name||"à préciser"}, en français.\n\nLes photographies correspondent à la carte mise en vente et permettent d’apprécier son état.\n\nExpédition soignée via Mondial Relay.`;
    $("listing").hidden=false;
    $("listing").scrollIntoView({behavior:"smooth"});
  }catch(e){$("status").textContent="Erreur de chargement des détails."}
}
$("copy").onclick=async()=>{
  const text=`${$("title").value}\n\n${$("description").value}\n\nPrix de départ : ${$("price").value} €\nDurée : ${$("duration").value} jours\nExpédition : Mondial Relay ${$("shipping").value} €`;
  await navigator.clipboard.writeText(text); $("copy").textContent="Copié ✓";setTimeout(()=>$("copy").textContent="Copier le texte de l'annonce",1500);
};
$("export").onclick=()=>{
  const obj={createdAt:new Date().toISOString(),title:$("title").value,description:$("description").value,startPrice:Number($("price").value),durationDays:Number($("duration").value),shippingPrice:Number($("shipping").value),card:state.card};
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:"application/json"}));a.download="pokemon-ebay.json";a.click();
};
$("reset").onclick=()=>location.reload();
function esc(s){return String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
