
const DEFAULT_MEALS = [
  {id:"coffee-cold", name:"קפה קר", calories:40, category:"coffee", active:true, icon:"🧊"},
  {id:"coffee-hot", name:"קפה חם קטן", calories:10, category:"coffee", active:true, icon:"☕"},
  {id:"muller", name:"מולר", calories:140, category:"breakfast", active:true, icon:"🥣"},
  {id:"pita-spelt", name:"פיתה כוסמין", calories:99, category:"breakfast", active:true, icon:"🫓"},
  {id:"spelt-roll", name:"לחמניית כוסמין", calories:160, category:"breakfast", active:true, icon:"🥖"},
  {id:"rice-cake", name:"פריכית", calories:16, category:"snack", active:true, icon:"🍘"},
  {id:"kinder2", name:"2 קינדר קארדס", calories:120, category:"sweet", active:true, icon:"🍫"},
  {id:"petit-nutella", name:"פתיבר עם נוטלה", calories:60, category:"sweet", active:true, icon:"🍪"},
  {id:"ice99", name:"שלגון 99", calories:99, category:"sweet", active:true, icon:"🍦"},
  {id:"fruit", name:"פרי", calories:70, category:"fruit", active:true, icon:"🍎"},
  {id:"pita-hummus-egg", name:"פיתה כוסמין + חומוס + חביתה מביצה אחת", calories:260, category:"meal", active:true, icon:"🫓"},
  {id:"2rice-cottage", name:"2 פריכיות + קוטג׳", calories:80, category:"snack", active:true, icon:"🥣"},
  {id:"rice-pb-honey", name:"פריכית + כפית רזה חמאת בוטנים ודבש", calories:70, category:"snack", active:true, icon:"🥜"},
  {id:"roll-salami", name:"לחמניית כוסמין + חרדל + 4 פרוסות סלמי דק", calories:240, category:"meal", active:true, icon:"🥪"},
  {id:"big-salad", name:"סלט גדול", calories:400, category:"meal", active:true, icon:"🥗"},
  {id:"corn-bulgur", name:"שניצל תירס לייט + בורגול + ירקות", calories:270, category:"meal", active:true, icon:"🍽️"},
  {id:"airfryer-potato", name:"פוטטו באיירפריי", calories:200, category:"meal", active:true, icon:"🥔"},
  {id:"fries-hummus", name:"צ׳יפס באיירפריי + חומוס", calories:300, category:"meal", active:true, icon:"🍟"},
];

const CATEGORY_LABELS = {
  coffee:"קפה", breakfast:"בוקר", snack:"נשנוש", sweet:"מתוק", meal:"ארוחה", fruit:"פרי"
};

const TIMES = ["07:30","09:00","10:30","12:30","14:30","17:00","19:30","21:00"];

let meals = JSON.parse(localStorage.getItem("bisli_meals") || "null") || DEFAULT_MEALS;
let settings = JSON.parse(localStorage.getItem("bisli_settings") || "null") || {morningCoffee:"cold"};
let editingId = null;
let currentCard = null;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function saveMeals(){ localStorage.setItem("bisli_meals", JSON.stringify(meals)); }
function saveSettings(){ localStorage.setItem("bisli_settings", JSON.stringify(settings)); }

function activeMeals(cat){
  return meals.filter(m => m.active && (!cat || m.category === cat));
}

function randomItem(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function shuffle(arr){ return [...arr].sort(()=>Math.random()-.5); }

function generateCard(){
  const pool = meals.filter(m=>m.active);
  const coffee = pool.find(m=>m.id === (settings.morningCoffee==="cold" ? "coffee-cold" : "coffee-hot"))
              || randomItem(pool.filter(m=>m.category==="coffee"));

  const sweets = shuffle(pool.filter(m=>m.category==="sweet"));
  const fruits = shuffle(pool.filter(m=>m.category==="fruit"));
  const breakfast = shuffle(pool.filter(m=>m.category==="breakfast"));
  const snacks = shuffle(pool.filter(m=>m.category==="snack"));
  const mainMeals = shuffle(pool.filter(m=>m.category==="meal"));

  let best = null;
  for(let attempt=0; attempt<1200; attempt++){
    const items = [];
    if(coffee) items.push(coffee);

    const used = new Set(items.map(x=>x.id));
    const pickUnique = (arr) => {
      const candidates = arr.filter(x=>!used.has(x.id));
      if(!candidates.length) return null;
      const x = randomItem(candidates);
      used.add(x.id);
      return x;
    };

    const oneBreakfast = pickUnique(breakfast);
    const oneSnack = pickUnique(snacks);
    const oneSweet = pickUnique(sweets);
    const oneFruit = pickUnique(fruits);
    const main1 = pickUnique(mainMeals);
    const main2 = Math.random() < .55 ? pickUnique(mainMeals) : null;
    [oneBreakfast, oneSnack, oneSweet, oneFruit, main1, main2].filter(Boolean).forEach(x=>items.push(x));

    // Fill to 7-9 items with remaining active non-coffee options
    const fillers = shuffle(pool.filter(m=>m.category!=="coffee" && !used.has(m.id)));
    const targetCount = 7 + Math.floor(Math.random()*3);
    while(items.length < targetCount && fillers.length){
      const x = fillers.pop();
      if(!used.has(x.id)){
        items.push(x); used.add(x.id);
      }
    }

    const total = items.reduce((s,m)=>s+m.calories,0);
    const score = total>=1100 && total<=1300 ? 0 : Math.min(Math.abs(total-1100),Math.abs(total-1300));

    if(!best || score < best.score){
      best = {items:[...items], total, score};
      if(score===0) break;
    }
  }

  // order: coffee, then balanced progression
  let chosen = best ? best.items : [];
  const coffeeItems = chosen.filter(x=>x.category==="coffee");
  const breakfastItems = chosen.filter(x=>x.category==="breakfast");
  const snackItems = chosen.filter(x=>x.category==="snack");
  const sweetItems = chosen.filter(x=>x.category==="sweet");
  const fruitItems = chosen.filter(x=>x.category==="fruit");
  const mealItems = chosen.filter(x=>x.category==="meal");

  let ordered = [
    ...coffeeItems.slice(0,1),
    ...breakfastItems.slice(0,1),
    ...snackItems.slice(0,1),
    ...mealItems.slice(0,1),
    ...sweetItems.slice(0,1),
    ...fruitItems.slice(0,1),
    ...mealItems.slice(1,2),
  ];

  const used2 = new Set(ordered.map(x=>x.id));
  chosen.filter(x=>!used2.has(x.id)).forEach(x=>ordered.push(x));
  ordered = ordered.slice(0, TIMES.length);

  currentCard = ordered.map((meal,i)=>({...meal,time:TIMES[i] || ""}));
  renderCard();
}

function renderCard(){
  const container = $("#dailyMenu");
  const total = currentCard.reduce((s,m)=>s+m.calories,0);
  $("#dayTotal").textContent = `${total} קל׳`;
  const dayName = new Intl.DateTimeFormat("he-IL",{weekday:"long"}).format(new Date());
  $("#dayTitle").textContent = dayName;
  container.innerHTML = currentCard.map(m=>`
    <div class="menu-row">
      <div class="menu-time">${m.time}</div>
      <div class="menu-name">${m.icon || "•"} ${m.name}</div>
      <div class="menu-cal">${m.calories} קל׳</div>
    </div>
  `).join("");
}

function renderMeals(){
  const q = $("#mealSearch").value.trim().toLowerCase();
  const list = meals.filter(m=>m.name.toLowerCase().includes(q));
  $("#mealsGrid").innerHTML = list.map(m=>`
    <div class="meal-card ${m.active ? "" : "inactive"}">
      <div class="meal-icon">${m.icon || "🍽️"}</div>
      <div class="meal-name">${m.name}</div>
      <div class="meal-meta">
        <span>${m.calories} קל׳</span>
        <span>${CATEGORY_LABELS[m.category]}</span>
      </div>
      <div class="card-actions">
        <button onclick="editMeal('${m.id}')">עריכה</button>
        <button onclick="toggleMeal('${m.id}')">${m.active ? "כבי" : "הפעילי"}</button>
      </div>
    </div>
  `).join("");
}

function toggleMeal(id){
  const m = meals.find(x=>x.id===id);
  if(!m) return;
  m.active = !m.active;
  saveMeals();
  renderMeals();
}

function editMeal(id){
  const m = meals.find(x=>x.id===id);
  if(!m) return;
  editingId = id;
  $("#mealDialogTitle").textContent = "עריכת מנה";
  $("#mealName").value = m.name;
  $("#mealCalories").value = m.calories;
  $("#mealCategory").value = m.category;
  $("#mealActive").checked = m.active;
  $("#deleteMealBtn").classList.remove("hidden");
  $("#mealDialog").showModal();
}

function openAddMeal(){
  editingId = null;
  $("#mealDialogTitle").textContent = "הוספת מנה";
  $("#mealForm").reset();
  $("#mealActive").checked = true;
  $("#deleteMealBtn").classList.add("hidden");
  $("#mealDialog").showModal();
}

$("#mealForm").addEventListener("submit", e=>{
  e.preventDefault();
  const data = {
    name: $("#mealName").value.trim(),
    calories: Number($("#mealCalories").value),
    category: $("#mealCategory").value,
    active: $("#mealActive").checked
  };
  if(!data.name || !data.calories) return;

  if(editingId){
    const idx = meals.findIndex(x=>x.id===editingId);
    meals[idx] = {...meals[idx], ...data};
  } else {
    meals.push({
      id: "user-"+Date.now(),
      icon:"🍽️",
      ...data
    });
  }
  saveMeals();
  renderMeals();
  $("#mealDialog").close();
});

$("#deleteMealBtn").addEventListener("click", ()=>{
  if(!editingId) return;
  const m = meals.find(x=>x.id===editingId);
  if(confirm(`למחוק את "${m.name}"?`)){
    meals = meals.filter(x=>x.id!==editingId);
    saveMeals();
    renderMeals();
    $("#mealDialog").close();
  }
});

$("#addMealBtn").addEventListener("click", openAddMeal);
$("#mealSearch").addEventListener("input", renderMeals);
$("#newCardBtn").addEventListener("click", generateCard);

$$(".nav-btn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    $$(".nav-btn").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    $$(".view").forEach(v=>v.classList.remove("active"));
    $("#"+btn.dataset.view).classList.add("active");
    if(btn.dataset.view==="mealsView") renderMeals();
  });
});

$("#settingsBtn").addEventListener("click", ()=>{
  updateCoffeeButtons();
  $("#settingsDialog").showModal();
});
$$("[data-close]").forEach(btn=>{
  btn.addEventListener("click", ()=>$("#"+btn.dataset.close).close());
});
$$("[data-coffee]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    settings.morningCoffee = btn.dataset.coffee;
    saveSettings();
    updateCoffeeButtons();
    generateCard();
  });
});
function updateCoffeeButtons(){
  $$("[data-coffee]").forEach(btn=>{
    btn.classList.toggle("selected", btn.dataset.coffee===settings.morningCoffee);
  });
}

window.editMeal = editMeal;
window.toggleMeal = toggleMeal;

renderMeals();
generateCard();
