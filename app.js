const $=id=>document.getElementById(id);
let state={front:null,back:null,card:null,ocr:""};

function preview(input,img){
  const f=input.files[0]; if(!f)return;
  const url=URL.createObjectURL(f); img.src=url; img.hidden=false;
  return f;
}
$("front").addEventListener("change",()=>{state.front=preview($("front"),$("frontPreview")); checkReady()});
$("back").addEventListener("change",()=>{state.back=preview($("back"),$("backPreview")); checkReady()});
function checkReady(){$("process").disabled=!(state.front&&state.back)}

$("process").onclick=async()=>{
  $("analysis").hidden=false;$("status").textContent="Lecture du recto…";
  try{
    const text=await ocrImage(state.front);
    state.ocr=text;$("ocrText").value=text.replace(/\s+/g," ").trim();
    $("status").innerHTML='<div class="ok">OCR terminé. Vérifiez le texte puis lancez la recherche.</div>';
  }catch(e){$("status").innerHTML='<div class="warn">OCR indisponible : vous pouvez saisir le nom/numéro manuellement.</div>'}
};
async function ocrImage(file){
  const worker=await Tesseract.createWorker("fra");
  const r=await worker.recognize(file);
  await worker.terminate(); return r.data.text||"";
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
