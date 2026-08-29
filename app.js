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
  $("status").textContent="Lecture de la zone d'identification…";

  try{
    const text=await ocrImage(state.identification);

    state.ocr=text;

    const cleaned=text
      .replace(/\s+/g," ")
      .trim();

    $("ocrText").value=cleaned;

    const localId=extractLocalId(cleaned);

    if(localId){
      $("localId").value=localId;
    }

    $("status").innerHTML=
      '<div class="ok">OCR terminé sur la photo d’identification. Vérifiez le numéro puis lancez la recherche.</div>';

  }catch(e){

    $("status").innerHTML=
      '<div class="warn">OCR indisponible : vous pouvez saisir manuellement le numéro et l’extension.</div>';

  }
};
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
$("search").onclick=async()=>{
  const q=$("ocrText").value.trim(), id=$("localId").value.trim();
  $("matches").textContent="Recherche…";
  try{
    let cards=[];
    // Try number + OCR words first; TCGdex supports filtering but API query syntax varies,
    // so the V1 uses the card list and local matching on a reduced set where possible.
    const res=await fetch("https://api.tcgdex.net/v2/fr/cards");
    const data=await res.json();
    const words=q.toLowerCase().split(/\s+/).filter(x=>x.length>=3);
    cards=data.filter(c=>{
      const name=(c.name||"").toLowerCase(), local=(c.localId||"").toLowerCase();
      const score=words.reduce((s,w)=>s+(name.includes(w)?2:0),0)+(id&&local===id.toLowerCase()?5:0);
      c._score=score; return score>0;
    }).sort((a,b)=>b._score-a._score).slice(0,8);
    renderMatches(cards);
  }catch(e){
    $("matches").innerHTML='<div class="warn">Impossible de contacter TCGdex. Vérifiez la connexion Internet.</div>';
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
