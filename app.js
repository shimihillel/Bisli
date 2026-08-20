// ביס לי v2.0 — החלפת מנה + סימון נאכל + ספירת קלוריות

const DEFAULT_MEALS = [
  {id:"coffee-cold", name:"קפה קר", calories:40, category:"coffee", active:true, icon:"🧊"},
  {id:"coffee-hot", name:"קפה חם קטן", calories:10, category:"coffee", active:true, icon:"☕"},
  {id:"muller", name:"מולר", calories:140, category:"between", active:true, icon:"🥣"},
  {id:"2rice-cottage", name:"2 פריכיות + קוטג׳", calories:80, category:"between", active:true, icon:"🥣"},
  {id:"kinder2", name:"2 קינדר קארדס", calories:120, category:"between", isSweet:true, active:true, icon:"🍫"},
  {id:"petit-nutella", name:"פתיבר עם נוטלה", calories:60, category:"between", isSweet:true, active:true, icon:"🍪"},
  {id:"ice99", name:"שלגון 99", calories:99, category:"between", isSweet:true, active:true, icon:"🍦"},
  {id:"fruit", name:"פרי", calories:70, category:"between", active:true, icon:"🍎", isFruit:true},
  {id:"pita-hummus-egg", name:"פיתה כוסמין + חומוס + חביתה מביצה אחת", calories:260, category:"meal", active:true, icon:"🫓"},
  {id:"rice-pb-honey", name:"פריכית + כפית רזה חמאת בוטנים ודבש", calories:70, category:"between", active:true, icon:"🥜"},
  {id:"roll-salami", name:"לחמניית כוסמין + חרדל + 4 פרוסות סלמי דק", calories:240, category:"meal", active:true, icon:"🥪"},
  {id:"big-salad", name:"סלט גדול", calories:400, category:"meal", active:true, icon:"🥗"},
  {id:"corn-bulgur", name:"שניצל תירס לייט + בורגול + ירקות", calories:270, category:"meal", active:true, icon:"🍽️"},
  {id:"airfryer-potato", name:"פוטטו באיירפריי", calories:200, category:"meal", active:true, icon:"🥔"},
  {id:"fries-hummus", name:"צ׳יפס באיירפריי + חומוס", calories:300, category:"meal", active:true, icon:"🍟"},
];

const CATEGORY_LABELS = { coffee:"קפה", between:"ביניים", meal:"ארוחה" };

const TIMES = ["07:30","09:00","10:30","12:30","14:30","17:00","19:30","21:00"];

let meals = JSON.parse(localStorage.getItem("bisli_meals") || "null") || DEFAULT_MEALS;


// v1.7 migration: keep every existing user-added item, but merge
// breakfast/snack/sweet into the single visible category "between".
let v17Migrated = false;
meals = meals.map(m => {
  if(m.category === "sweet"){
    v17Migrated = true;
    return {...m, category:"between", isSweet:true};
  }
  if(m.category === "breakfast" || m.category === "snack"){
    v17Migrated = true;
    return {...m, category:"between"};
  }
  if(m.category === "fruit"){
    v17Migrated = true;
    return {...m, category:"between", isFruit:true};
  }
  return m;
});
if(v17Migrated){
  localStorage.setItem("bisli_meals", JSON.stringify(meals));
}

// Migration from early versions:
// standalone bread/rice-cake items were calorie references, not complete suggestions.
// Remove those legacy defaults so they can never appear alone in a daily card.
const LEGACY_BASE_IDS = new Set(["pita-spelt","spelt-roll","rice-cake"]);
const beforeMigration = meals.length;

// Convert the old visible "fruit" category into a hidden flexible-fruit flag.
meals = meals.map(m => {
  if (m.id === "fruit" || m.category === "fruit") {
    return {...m, category:"between", isFruit:true};
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
let eatenSlots = new Set();

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

function loadEatenState(){
  try{
    const saved = JSON.parse(localStorage.getItem("bisli_eaten_state") || "null");
    if(saved && saved.date===localDateKey() && Array.isArray(saved.times)){
      eatenSlots = new Set(saved.times);
      return;
    }
  }catch(e){}
  eatenSlots = new Set();
}

function saveEatenState(){
  localStorage.setItem("bisli_eaten_state", JSON.stringify({
    date: localDateKey(),
    times:[...eatenSlots]
  }));
}

function resetEatenState(){
  eatenSlots = new Set();
  saveEatenState();
}

function eatenCalories(){
  return currentCard
    .filter(item=>eatenSlots.has(item.time))
    .reduce((sum,item)=>sum + Number(item.calories || 0), 0);
}

function toggleEaten(time){
  if(eatenSlots.has(time)) eatenSlots.delete(time);
  else eatenSlots.add(time);
  saveEatenState();
  renderCard();
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

const MEAL_SLOTS = new Set(["12:30","19:30"]);
const BETWEEN_SLOTS = new Set(["09:00","10:30","14:30","21:00"]);
const COFFEE_SLOTS = new Set(["07:30","17:00"]);

function isBreadBased(item){
  if(!item) return false;
  const n = item.name || "";
  return n.includes("פיתה כוסמין") || n.includes("לחמניית כוסמין");
}


function cardHasFruit(card){
  return card.some(x=>x.isFruit);
}

function cardHasSweet(card){
  // If no sweet-tagged items exist in the active database, do not block replacements.
  const sweetExists = meals.some(m=>m.active && m.isSweet);
  return !sweetExists || card.some(x=>x.isSweet);
}

function replacementCandidateValid(testCard, time, original, candidate){
  if(testCard.filter(isBreadBased).length > 1) return false;
  if(!cardHasFruit(testCard)) return false;
  if(!cardHasSweet(testCard)) return false;

  if(COFFEE_SLOTS.has(time) && candidate.category!=="coffee") return false;
  if(BETWEEN_SLOTS.has(time) && candidate.category!=="between") return false;

  if(MEAL_SLOTS.has(time)){
    // Preserve the role of this slot. In a one-large-meal day, a between slot
    // stays between; in a two-small-meal day, a small meal stays a small meal.
    if(original.category==="between" && candidate.category!=="between") return false;
    if(original.category==="meal"){
      if(candidate.category!=="meal") return false;
      const originalLarge = original.calories >= 320;
      const candidateLarge = candidate.calories >= 320;
      if(originalLarge !== candidateLarge) return false;
    }
  }

  return true;
}

function replaceSlot(time){
  if(eatenSlots.has(time)) return;

  const index = currentCard.findIndex(x=>x.time===time);
  if(index<0) return;

  const original = currentCard[index];
  const pool = meals.filter(m=>m.active && !m.baseOnly && m.id!==original.id);
  const otherIds = new Set(currentCard.filter((_,i)=>i!==index).map(x=>x.id));

  let candidates = pool.filter(candidate=>{
    // Coffee may repeat across the two fixed coffee slots; other items should not.
    if(candidate.category!=="coffee" && otherIds.has(candidate.id)) return false;

    // Replacing the generic fruit should stay fruit so the daily fruit rule survives.
    if(original.isFruit && !candidate.isFruit) return false;

    const testCard = currentCard.map((item,i)=>
      i===index ? {...candidate, time} : item
    );
    return replacementCandidateValid(testCard, time, original, candidate);
  });

  if(!candidates.length) return;

  const currentTotal = currentCard.reduce((s,m)=>s+m.calories,0);
  const target = 1200;

  candidates = candidates
    .map(candidate=>{
      const newTotal = currentTotal - original.calories + candidate.calories;
      let score = Math.abs(newTotal-target);
      if(newTotal<1100) score += (1100-newTotal)*2;
      if(newTotal>1300) score += (newTotal-1300)*2;
      score += recentMealPenalty(candidate.id) * (candidate.category==="meal" ? 18 : 5);
      return {candidate, score};
    })
    .sort((a,b)=>a.score-b.score);

  // Pick from the best few so repeated taps on "החלף" still feel varied.
  const top = candidates.slice(0, Math.min(3,candidates.length));
  const picked = top[Math.floor(Math.random()*top.length)].candidate;

  currentCard[index] = {...picked, time};
  saveTodayCard(currentCard);
  renderCard();
}

function generateCard(saveAsToday=true){
  const pool = meals.filter(m=>m.active && !m.baseOnly);

  const preferredCoffeeId = settings.morningCoffee==="cold" ? "coffee-cold" : "coffee-hot";
  const coffee = pool.find(m=>m.id===preferredCoffeeId)
              || randomItem(pool.filter(m=>m.category==="coffee"));

  const between = pool.filter(m=>m.category==="between" && !m.isFruit);
  const fruits = pool.filter(m=>m.isFruit);
  const sweets = between.filter(m=>m.isSweet);

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
    pool.filter(m => m.category==="between" && !m.isFruit);

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
    slots["09:00"] = pickUnique(between, used);
    slots["10:30"] = pickUnique(between, used);

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
        slots["19:30"] = pickUnique(between, used);
      } else {
        // Lunch is a substantial non-meal; dinner is the one large meal.
        slots["12:30"] = pickUnique(between, used);
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
    slots["14:30"] = pickUnique(sweets, used) || pickUnique(between, used);

    // 21:00 can only be snack/sweet, never a meal.
    slots["21:00"] = pickUnique(sweets, used) || pickUnique(between, used);

    // Put fruit into a sensible non-meal slot, replacing only another non-meal.
    if(fruit){
      const fruitSlots = shuffle(["10:30","14:30","21:00"]);
      const target = fruitSlots.find(t => slots[t] && slots[t].category!=="meal") || "14:30";
      slots[target] = fruit;
    }

    // Fill only between-meal slots; meal slots are controlled above.
    const fillers = shuffle(nonMealFillers().filter(x=>!used.has(x.id)));
    for(const time of BETWEEN_SLOTS){
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

    for(const [time, item] of Object.entries(slots)){
      if(item?.category==="meal" && !MEAL_SLOTS.has(time)){
        validStructure = false;
      }
    }

    for(const time of BETWEEN_SLOTS){
      if(slots[time] && slots[time].category!=="between"){
        validStructure = false;
      }
    }

    if(slots["07:30"]?.category!=="coffee" || slots["17:00"]?.category!=="coffee"){
      validStructure = false;
    }

    if(!fruit || !card.some(x=>x.isFruit)) validStructure = false;
    if(!coffee || !slots["07:30"] || !slots["17:00"]) validStructure = false;

    // Hard rule: no "spelt festival" — at most one pita/roll-based item per day.
    const breadCount = card.filter(isBreadBased).length;
    if(breadCount > 1) validStructure = false;

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

    // Extra safety: strongly penalize more than one pita/roll-based item.
    const breadCountForScore = card.filter(isBreadBased).length;
    if(breadCountForScore > 1) score += (breadCountForScore - 1) * 6000;

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
  $("#eatenTotal").textContent = `${eatenCalories()} קל׳`;

  const dayName = new Intl.DateTimeFormat("he-IL",{weekday:"long"}).format(new Date());
  $("#dayTitle").textContent = dayName;

  container.innerHTML = currentCard.map(m=>{
    const eaten = eatenSlots.has(m.time);
    return `
      <div class="menu-row ${eaten ? "eaten" : ""}">
        <div class="menu-time">${m.time}</div>
        <div class="menu-main">
          <div class="menu-name">${m.icon || "•"} ${m.name}</div>
          <div class="row-actions">
            <button class="row-action eat ${eaten ? "active" : ""}" data-eat-time="${m.time}">
              ${eaten ? "✓ נאכל" : "✓ אכלתי"}
            </button>
            <button class="row-action replace" data-replace-time="${m.time}" ${eaten ? "disabled" : ""}>
              ↻ החלף
            </button>
          </div>
        </div>
        <div class="menu-cal">${m.calories} קל׳</div>
      </div>
    `;
  }).join("");

  $$("[data-eat-time]").forEach(btn=>{
    btn.addEventListener("click", ()=>toggleEaten(btn.dataset.eatTime));
  });

  $$("[data-replace-time]").forEach(btn=>{
    btn.addEventListener("click", ()=>replaceSlot(btn.dataset.replaceTime));
  });
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
$("#newCardBtn").addEventListener("click", ()=>{
  if(eatenSlots.size){
    const ok = confirm("יש דברים שכבר סימנת כנאכלו. כרטיס אחר יאפס את סימוני האכילה של היום. להמשיך?");
    if(!ok) return;
  }
  resetEatenState();
  generateCard(true);
});

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

if(localStorage.getItem("bisli_schedule_version") !== "2.0"){
  localStorage.setItem("bisli_schedule_version","2.0");
}

loadEatenState();

const savedTodayCard = loadTodayCard();
if(savedTodayCard){
  currentCard = savedTodayCard;
  renderCard();
} else {
  generateCard(true);
}
