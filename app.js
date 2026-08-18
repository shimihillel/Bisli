// ביס לי v1.6 — כרטיס יומי נשמר לפי תאריך

const DEFAULT_MEALS = [
  {id:"coffee-cold", name:"קפה קר", calories:40, category:"coffee", active:true, icon:"🧊"},
  {id:"coffee-hot", name:"קפה חם קטן", calories:10, category:"coffee", active:true, icon:"☕"},
  {id:"muller", name:"מולר", calories:140, category:"breakfast", active:true, icon:"🥣"},
  {id:"2rice-cottage", name:"2 פריכיות + קוטג׳", calories:80, category:"breakfast", active:true, icon:"🥣"},
  {id:"kinder2", name:"2 קינדר קארדס", calories:120, category:"sweet", active:true, icon:"🍫"},
  {id:"petit-nutella", name:"פתיבר עם נוטלה", calories:60, category:"sweet", active:true, icon:"🍪"},
  {id:"ice99", name:"שלגון 99", calories:99, category:"sweet", active:true, icon:"🍦"},
  {id:"fruit", name:"פרי", calories:70, category:"snack", active:true, icon:"🍎", isFruit:true},
  {id:"pita-hummus-egg", name:"פיתה כוסמין + חומוס + חביתה מביצה אחת", calories:260, category:"meal", active:true, icon:"🫓"},
  {id:"rice-pb-honey", name:"פריכית + כפית רזה חמאת בוטנים ודבש", calories:70, category:"snack", active:true, icon:"🥜"},
  {id:"roll-salami", name:"לחמניית כוסמין + חרדל + 4 פרוסות סלמי דק", calories:240, category:"meal", active:true, icon:"🥪"},
  {id:"big-salad", name:"סלט גדול", calories:400, category:"meal", active:true, icon:"🥗"},
  {id:"corn-bulgur", name:"שניצל תירס לייט + בורגול + ירקות", calories:270, category:"meal", active:true, icon:"🍽️"},
  {id:"airfryer-potato", name:"פוטטו באיירפריי", calories:200, category:"meal", active:true, icon:"🥔"},
  {id:"fries-hummus", name:"צ׳יפס באיירפריי + חומוס", calories:300, category:"meal", active:true, icon:"🍟"},
];

const CATEGORY_LABELS = {
  coffee:"קפה", breakfast:"בוקר", snack:"נשנוש", sweet:"מתוק", meal:"ארוחה"
};

const TIMES = ["07:30","09:00","10:30","12:30","14:30","17:00","19:30","21:00"];

let meals = JSON.parse(localStorage.getItem("bisli_meals") || "null") || DEFAULT_MEALS;

// Migration from early versions:
// standalone bread/rice-cake items were calorie references, not complete suggestions.
// Remove those legacy defaults so they can never appear alone in a daily card.
const LEGACY_BASE_IDS = new Set(["pita-spelt","spelt-roll","rice-cake"]);
const beforeMigration = meals.length;

// Convert the old visible "fruit" category into a hidden flexible-fruit flag.
meals = meals.map(m => {
  if (m.id === "fruit" || m.category === "fruit") {
    return {...m, category:"snack", isFruit:true};
  }
  return m;
});
meals = meals.filter(m => !LEGACY_BASE_IDS.has(m.id));
if (meals.length !== beforeMigration || meals.some(m => m.isFruit && m.category === "snack")) {
  localStorage.setItem("bisli_meals", JSON.stringify(meals));
}
let settings = JSON.parse(localStorage.getItem("bisli_settings") || "null") || {morningCoffee:"cold"};
let editingId = null;
let currentCard = null;
let cardHistory = JSON.parse(localStorage.getItem("bisli_card_history") || "[]");

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function saveMeals(){ localStorage.setItem("bisli_meals", JSON.stringify(meals)); }
function saveSettings(){ localStorage.setItem("bisli_settings", JSON.stringify(settings)); }

function activeMeals(cat){
  return meals.filter(m => m.active && (!cat || m.category === cat));
}

function randomItem(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function shuffle(arr){ return [...arr].sort(()=>Math.random()-.5); }

function localDateKey(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function saveTodayCard(card){
  localStorage.setItem("bisli_today_card", JSON.stringify({
    date: localDateKey(),
    card
  }));
}

function loadTodayCard(){
  try{
    const saved = JSON.parse(localStorage.getItem("bisli_today_card") || "null");
    if(saved && saved.date===localDateKey() && Array.isArray(saved.card) && saved.card.length){
      return saved.card;
    }
  }catch(e){}
  return null;
}

function recentMealPenalty(id){
  let penalty = 0;
  cardHistory.slice(0,5).forEach((card, idx)=>{
    if(card.mealIds?.includes(id)){
      penalty += [14,9,6,4,2][idx] || 1;
    }
  });
  return penalty;
}

function weightedPick(arr, used){
  const candidates = arr.filter(x=>!used.has(x.id));
  if(!candidates.length) return null;

  const scored = candidates.map(x=>({
    item:x,
    weight: Math.max(1, 16 - recentMealPenalty(x.id))
  }));

  const totalWeight = scored.reduce((s,x)=>s+x.weight,0);
  let r = Math.random()*totalWeight;
  for(const x of scored){
    r -= x.weight;
    if(r<=0){
      used.add(x.item.id);
      return x.item;
    }
  }
  const last = scored[scored.length-1].item;
  used.add(last.id);
  return last;
}

function pairWasRecent(a,b){
  if(!a || !b) return false;
  const key = [a.id,b.id].sort().join("|");
  return cardHistory.slice(0,5).some(c=>c.mealPair===key);
}

function rememberCard(card){
  const mealItems = card.filter(x=>x.category==="meal");
  const mealPair = mealItems.length>=2
    ? [mealItems[0].id,mealItems[1].id].sort().join("|")
    : mealItems.length===1 ? mealItems[0].id : "";

  cardHistory.unshift({
    mealIds: card.map(x=>x.id),
    mealPair
  });
  cardHistory = cardHistory.slice(0,8);
  localStorage.setItem("bisli_card_history", JSON.stringify(cardHistory));
}

function generateCard(saveAsToday=true){
  const pool = meals.filter(m=>m.active && !m.baseOnly);

  const preferredCoffeeId = settings.morningCoffee==="cold" ? "coffee-cold" : "coffee-hot";
  const coffee = pool.find(m=>m.id===preferredCoffeeId)
              || randomItem(pool.filter(m=>m.category==="coffee"));

  const breakfast = pool.filter(m=>m.category==="breakfast");
  const snacks = pool.filter(m=>m.category==="snack" && !m.isFruit);
  const fruits = pool.filter(m=>m.isFruit);
  const sweets = pool.filter(m=>m.category==="sweet");

  // Meal size is inferred only from calories; no extra field is needed in the UI.
  // 320+ = large meal. Under 320 = small meal.
  const largeMeals = pool.filter(m=>m.category==="meal" && m.calories>=320);
  const smallMeals = pool.filter(m=>m.category==="meal" && m.calories<320);

  // Bread-based small meals should stay visible in the rotation:
  // examples: pita + hummus + egg, or spelt roll + salami.
  const breadSmallMeals = smallMeals.filter(m =>
    m.name.includes("פיתה כוסמין") || m.name.includes("לחמניית כוסמין")
  );
  const otherSmallMeals = smallMeals.filter(m => !breadSmallMeals.includes(m));

  const pickUnique = (arr, used) => weightedPick(arr, used);

  const nonMealFillers = () =>
    pool.filter(m =>
      m.category!=="coffee" &&
      m.category!=="meal" &&
      !m.isFruit
    );

  let best = null;

  for(let attempt=0; attempt<5000; attempt++){
    const used = new Set();
    const slots = {};

    // Fixed coffee rhythm.
    if(coffee){
      slots["07:30"] = coffee;
      slots["17:00"] = coffee; // same current coffee "season"
      used.add(coffee.id);
    }

    // Morning basics.
    slots["09:00"] = pickUnique(breakfast, used) || pickUnique(snacks, used);
    slots["10:30"] = pickUnique(snacks, used) || pickUnique(sweets, used);

    // At least one fruit every day.
    const fruit = pickUnique(fruits, used);

    // Choose one of the only two allowed meal structures:
    // A) one large meal + a non-meal in the other main slot
    // B) two small meals: lunch + dinner
    const canLarge = largeMeals.length > 0;
    const canTwoSmall = smallMeals.length >= 2;
    let structure;

    if(canLarge && canTwoSmall){
      structure = Math.random() < 0.30 ? "large" : "two-small";
    } else if(canLarge){
      structure = "large";
    } else {
      structure = "two-small";
    }

    if(structure==="large"){
      const large = pickUnique(largeMeals, used);
      const largeAtLunch = Math.random() < 0.65;

      if(largeAtLunch){
        slots["12:30"] = large;
        // Evening is deliberately NOT another meal.
        slots["19:30"] = pickUnique(snacks, used)
                      || pickUnique(breakfast, used)
                      || pickUnique(sweets, used);
      } else {
        // Lunch is a substantial non-meal; dinner is the one large meal.
        slots["12:30"] = pickUnique(breakfast, used)
                      || pickUnique(snacks, used)
                      || pickUnique(sweets, used);
        slots["19:30"] = large;
      }
    } else {
      let smallA = null;
      let smallB = null;

      if(breadSmallMeals.length){
        // Make one of the two small meals a pita/roll style meal.
        smallA = pickUnique(breadSmallMeals, used);

        // Prefer a different style for the second small meal.
        smallB = pickUnique(otherSmallMeals, used)
              || pickUnique(smallMeals, used);
      } else {
        smallA = pickUnique(smallMeals, used);
        smallB = pickUnique(smallMeals, used);
      }

      // Randomize whether the bread-style meal lands at lunch or dinner.
      if(Math.random() < 0.5){
        slots["12:30"] = smallA;
        slots["19:30"] = smallB;
      } else {
        slots["12:30"] = smallB;
        slots["19:30"] = smallA;
      }
    }

    // Afternoon and late evening are always non-meal.
    slots["14:30"] = pickUnique(sweets, used)
                  || pickUnique(snacks, used)
                  || pickUnique(breakfast, used);

    // 21:00 can only be snack/sweet, never a meal.
    slots["21:00"] = pickUnique(sweets, used)
                  || pickUnique(snacks, used)
                  || pickUnique(breakfast, used);

    // Put fruit into a sensible non-meal slot, replacing only another non-meal.
    if(fruit){
      const fruitSlots = shuffle(["10:30","14:30","21:00"]);
      const target = fruitSlots.find(t => slots[t] && slots[t].category!=="meal") || "14:30";
      slots[target] = fruit;
    }

    // Fill any holes with non-meal items only.
    const fillers = shuffle(nonMealFillers().filter(x=>!used.has(x.id)));
    for(const time of TIMES){
      if(time==="07:30" || time==="17:00") continue;
      if(!slots[time]){
        const next = fillers.find(x=>!used.has(x.id));
        if(next){
          slots[time] = next;
          used.add(next.id);
        }
      }
    }

    const card = TIMES.map(time => slots[time] ? {...slots[time], time} : null).filter(Boolean);

    // Validate the structure strictly.
    const lunch = slots["12:30"];
    const dinner = slots["19:30"];
    const late = slots["21:00"];

    const lunchIsMeal = lunch?.category==="meal";
    const dinnerIsMeal = dinner?.category==="meal";
    const mealCount = [lunchIsMeal, dinnerIsMeal].filter(Boolean).length;

    let validStructure = false;
    if(mealCount===1){
      const onlyMeal = lunchIsMeal ? lunch : dinner;
      validStructure = onlyMeal.calories>=320;
    } else if(mealCount===2){
      validStructure = lunch.calories<320 && dinner.calories<320;
    }

    if(late?.category==="meal") validStructure = false;
    if(!fruit || !card.some(x=>x.isFruit)) validStructure = false;
    if(!coffee || !slots["07:30"] || !slots["17:00"]) validStructure = false;

    const lunchMeal = slots["12:30"]?.category==="meal" ? slots["12:30"] : null;
    const dinnerMeal = slots["19:30"]?.category==="meal" ? slots["19:30"] : null;
    const repeatedPair = pairWasRecent(lunchMeal, dinnerMeal);

    const total = card.reduce((s,m)=>s+m.calories,0);

    // Scoring: structure first, then calorie target, then card completeness.
    let score = 0;
    if(!validStructure) score += 10000;
    if(card.length < 8) score += (8-card.length)*1000;

    if(total < 1100) score += (1100-total)*4;     // strongly discourage too-low days
    else if(total > 1300) score += (total-1300)*3;
    else score -= 500; // reward being inside target

    // Prefer not to repeat the exact same non-coffee item.
    const nonCoffeeIds = card.filter(x=>x.category!=="coffee").map(x=>x.id);
    score += (nonCoffeeIds.length - new Set(nonCoffeeIds).size) * 500;

    // Strong anti-repeat memory across recent cards.
    card.forEach(item=>{
      const p = recentMealPenalty(item.id);
      score += p * (item.category==="meal" ? 32 : 8);
    });

    if(repeatedPair) score += 1400;

    const lastIds = new Set(cardHistory[0]?.mealIds || []);
    const overlap = card.filter(x=>lastIds.has(x.id) && x.category!=="coffee").length;
    score += overlap * 110;

    if(!best || score < best.score){
      best = {card, total, score};
      if(score <= -500) break;
    }
  }

  currentCard = best?.card || [];
  if(currentCard.length){
    rememberCard(currentCard);
    if(saveAsToday){
      saveTodayCard(currentCard);
    }
  }
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
$("#newCardBtn").addEventListener("click", ()=>generateCard(true));

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

const savedTodayCard = loadTodayCard();
if(savedTodayCard){
  currentCard = savedTodayCard;
  renderCard();
} else {
  generateCard(true);
}
