/* =========================================================
   NUTRITRACK
   Version 1.3
   ========================================================= */

const API = "https://world.openfoodfacts.org/cgi/search.pl";

const defaultGoals = {
    calories: 2000,
    protein: 150,
    carbs: 250,
    fat: 70
};

let goals = load("calorieGoals", defaultGoals);

let foodLog = load("calorieLog", []);

let favourites = load("favouriteFoods", []);

let savedMeals = load("savedMeals", []);

let customFoods = load("customFoods", []);

let selectedFood = null;

let scannerStream = null;

let deferredInstallPrompt = null;

let progressRange = 7;

let currentFoodTab = "favourites";


/* =========================================================
   STORAGE
   ========================================================= */

function load(key, fallback) {

    try {
        const data = localStorage.getItem(key);

        return data ? JSON.parse(data) : fallback;

    } catch {

        return fallback;

    }

}


function save(key, value) {

    localStorage.setItem(
        key,
        JSON.stringify(value)
    );

}


/* =========================================================
   DATE
   ========================================================= */

function todayKey() {

    const d = new Date();

    const year = d.getFullYear();

    const month = String(d.getMonth() + 1).padStart(2, "0");

    const day = String(d.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;

}


function dateFromKey(key) {

    const [y, m, d] = key.split("-");

    return new Date(
        Number(y),
        Number(m) - 1,
        Number(d)
    );

}


function dateLabel(key) {

    return dateFromKey(key).toLocaleDateString(
        undefined,
        {
            weekday: "short",
            day: "numeric",
            month: "short"
        }
    );

}


function getDateKeys(days) {

    const dates = [];

    for (let i = days - 1; i >= 0; i--) {

        const d = new Date();

        d.setDate(
            d.getDate() - i
        );

        const year = d.getFullYear();

        const month = String(
            d.getMonth() + 1
        ).padStart(2, "0");

        const day = String(
            d.getDate()
        ).padStart(2, "0");

        dates.push(
            `${year}-${month}-${day}`
        );

    }

    return dates;

}


/* =========================================================
   TODAY
   ========================================================= */

function todayFoods() {

    return foodLog.filter(
        food => food.date === todayKey()
    );

}


function totalsForDate(date) {

    const foods = foodLog.filter(
        food => food.date === date
    );

    return {

        calories: foods.reduce(
            (sum, food) => sum + Number(food.calories || 0),
            0
        ),

        protein: foods.reduce(
            (sum, food) => sum + Number(food.protein || 0),
            0
        ),

        carbs: foods.reduce(
            (sum, food) => sum + Number(food.carbs || 0),
            0
        ),

        fat: foods.reduce(
            (sum, food) => sum + Number(food.fat || 0),
            0
        ),

        count: foods.length

    };

}


/* =========================================================
   DASHBOARD
   ========================================================= */

function updateDashboard() {

    const totals = totalsForDate(todayKey());

    document.getElementById("calories").textContent =
        Math.round(totals.calories);

    const remaining =
        Math.max(
            goals.calories - totals.calories,
            0
        );

    document.getElementById("remaining").textContent =
        Math.round(remaining);

    document.getElementById("targetLabel").textContent =
        `${goals.calories} kcal`;

    document.getElementById("protein").textContent =
        Math.round(totals.protein);

    document.getElementById("carbs").textContent =
        Math.round(totals.carbs);

    document.getElementById("fat").textContent =
        Math.round(totals.fat);

    document.getElementById("proteinTarget").textContent =
        goals.protein;

    document.getElementById("carbsTarget").textContent =
        goals.carbs;

    document.getElementById("fatTarget").textContent =
        goals.fat;


    const caloriePercent =
        goals.calories > 0
            ? Math.min(
                totals.calories / goals.calories * 100,
                100
            )
            : 0;


    document.getElementById("calorieProgress").style.width =
        `${caloriePercent}%`;


    document.querySelector(".calorie-ring")
        .style.setProperty(
            "--ring-progress",
            `${caloriePercent * 3.6}deg`
        );


    setProgress(
        "proteinProgress",
        totals.protein,
        goals.protein
    );

    setProgress(
        "carbsProgress",
        totals.carbs,
        goals.carbs
    );

    setProgress(
        "fatProgress",
        totals.fat,
        goals.fat
    );


    document.getElementById("todayDate").textContent =
        new Date().toLocaleDateString(
            undefined,
            {
                weekday: "long",
                day: "numeric",
                month: "long"
            }
        );


    renderMeals();

}


function setProgress(id, value, target) {

    const percent =
        target > 0
            ? Math.min(value / target * 100, 100)
            : 0;

    document.getElementById(id)
        .style.width = `${percent}%`;

}


/* =========================================================
   MEALS
   ========================================================= */

function renderMeals() {

    const container =
        document.getElementById("meals");

    const meals = [
        "Breakfast",
        "Lunch",
        "Dinner",
        "Snacks"
    ];

    const foods = todayFoods();

    container.innerHTML = "";

    meals.forEach(meal => {

        const mealFoods =
            foods.filter(
                food => food.meal === meal
            );

        const total =
            mealFoods.reduce(
                (sum, food) =>
                    sum + Number(food.calories || 0),
                0
            );

        const section =
            document.createElement("div");

        section.className = "meal";

        section.innerHTML = `
            <div class="meal-header">
                <strong>${meal}</strong>
                <span>${Math.round(total)} kcal</span>
            </div>
        `;


        if (mealFoods.length === 0) {

            const empty =
                document.createElement("div");

            empty.className = "food-item";

            empty.innerHTML = `
                <div class="food-main">
                    <span>No food logged yet</span>
                </div>
            `;

            section.appendChild(empty);

        } else {

            mealFoods.forEach(food => {

                const item =
                    document.createElement("div");

                item.className = "food-item";

                item.innerHTML = `
                    <div class="food-main">
                        <strong>${escapeHtml(food.name)}</strong>
                        <span>
                            ${Math.round(food.amount || 0)}g ·
                            P ${Math.round(food.protein || 0)}g ·
                            C ${Math.round(food.carbs || 0)}g ·
                            F ${Math.round(food.fat || 0)}g
                        </span>
                    </div>

                    <div class="food-calories">
                        <strong>${Math.round(food.calories)} kcal</strong>
                    </div>

                    <button
                        class="remove-food"
                        data-id="${food.id}"
                    >
                        ×
                    </button>
                `;

                section.appendChild(item);

            });

        }

        container.appendChild(section);

    });


    document.querySelectorAll(".remove-food")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const id =
                        Number(button.dataset.id);

                    foodLog =
                        foodLog.filter(
                            food => food.id !== id
                        );

                    save("calorieLog", foodLog);

                    updateDashboard();

                    showToast("Food removed");

                }
            );

        });

}


/* =========================================================
   NAVIGATION
   ========================================================= */

document.querySelectorAll(".nav-item")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                showPage(
                    button.dataset.page
                );

            }
        );

    });


function showPage(pageId) {

    document.querySelectorAll(".page")
        .forEach(page => {

            page.classList.remove("active");

        });


    document.getElementById(pageId)
        .classList.add("active");


    document.querySelectorAll(".nav-item")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.page === pageId
            );

        });


    if (pageId === "progressPage") {

        renderProgress();

    }


    if (pageId === "foodsPage") {

        renderFoodLibrary();

    }


    if (pageId === "settingsPage") {

        loadGoalInputs();

    }


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


/* =========================================================
   MODAL
   ========================================================= */

function openModal() {

    document.getElementById("modal")
        .classList.remove("hidden");

    switchAddMode("searchMode");

    document.getElementById("foodSearch").focus();

}


function closeModal() {

    document.getElementById("modal")
        .classList.add("hidden");

    stopScanner();

}


document.getElementById("addFoodBtn")
    .addEventListener(
        "click",
        openModal
    );


document.getElementById("navAdd")
    .addEventListener(
        "click",
        openModal
    );


document.getElementById("closeModal")
    .addEventListener(
        "click",
        closeModal
    );


/* =========================================================
   ADD MODES
   ========================================================= */

document.querySelectorAll(".option-btn")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const id =
                    button.id
                        .replace("Btn", "");

                switchAddMode(id);

            }
        );

    });


function switchAddMode(mode) {

    const modes = [
        "searchMode",
        "barcodeMode",
        "quickMode",
        "manualMode"
    ];

    modes.forEach(id => {

        document.getElementById(id)
            .classList.toggle(
                "hidden",
                id !== mode
            );

    });


    document.querySelectorAll(".option-btn")
        .forEach(button => {

            button.classList.remove("active");

        });


    const button =
        document.getElementById(
            mode + "Btn"
        );

    if (button) {

        button.classList.add("active");

    }


    document.getElementById("foodEditor")
        .classList.add("hidden");

}


/* =========================================================
   OPEN FOOD FACTS SEARCH
   ========================================================= */

document.getElementById("searchBtn")
    .addEventListener(
        "click",
        searchFoods
    );


document.getElementById("foodSearch")
    .addEventListener(
        "keydown",
        event => {

            if (event.key === "Enter") {

                searchFoods();

            }

        }
    );


async function searchFoods() {

    const query =
        document.getElementById("foodSearch")
            .value
            .trim();


    if (!query) {

        showToast("Enter a food to search");

        return;

    }


    const results =
        document.getElementById("results");


    results.innerHTML =
        `<div class="chart-empty">Searching...</div>`;


    try {

        const url =
            `${API}?search_terms=${encodeURIComponent(query)}` +
            `&search_simple=1` +
            `&action=process` +
            `&json=1` +
            `&page_size=20` +
            `&fields=code,product_name,brands,image_front_small_url,nutriments`;


        const response =
            await fetch(url);


        if (!response.ok) {

            throw new Error("Search failed");

        }


        const data =
            await response.json();


        renderSearchResults(
            data.products || []
        );


    } catch (error) {

        console.error(error);

        results.innerHTML = `
            <div class="chart-empty">
                Search failed. Check your internet connection and try again.
            </div>
        `;

    }

}


/* =========================================================
   SEARCH RESULTS
   ========================================================= */

function renderSearchResults(products) {

    const container =
        document.getElementById("results");

    container.innerHTML = "";


    const usable =
        products.filter(
            product => {

                const nutrition =
                    getNutrition(product);

                return (
                    product.product_name &&
                    nutrition.calories !== null
                );

            }
        );


    if (!usable.length) {

        container.innerHTML =
            `<div class="chart-empty">
                No suitable foods found.
            </div>`;

        return;

    }


    usable.forEach(product => {

        const nutrition =
            getNutrition(product);


        const code =
            product.code || "";


        const isFav =
            favourites.some(
                food => food.code === code
            );


        const card =
            document.createElement("div");

        card.className = "result-card";


        const image =
            product.image_front_small_url ||
            "";


        card.innerHTML = `
            <img
                src="${image}"
                alt=""
                onerror="this.style.visibility='hidden'"
            >

            <div class="result-info">
                <strong>
                    ${escapeHtml(product.product_name)}
                </strong>

                <span>
                    ${escapeHtml(product.brands || "Unknown brand")}
                </span>

                <span>
                    ${Math.round(nutrition.calories)} kcal
                    · P ${Math.round(nutrition.protein)}g
                    · C ${Math.round(nutrition.carbs)}g
                    · F ${Math.round(nutrition.fat)}g
                    / 100g
                </span>
            </div>

            <button
                class="favourite-btn ${isFav ? "active" : ""}"
                data-code="${escapeHtml(code)}"
                title="Favourite"
            >
                ★
            </button>

            <button
                class="secondary-btn select-food"
                style="padding:9px 11px"
            >
                Add
            </button>
        `;


        card.querySelector(".select-food")
            .addEventListener(
                "click",
                () => selectFood(product)
            );


        card.querySelector(".favourite-btn")
            .addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    toggleFavourite(product);

                }
            );


        container.appendChild(card);

    });

}


/* =========================================================
   NUTRITION
   ========================================================= */

function getNutrition(product) {

    const n =
        product.nutriments || {};


    const calories =
        Number(
            n["energy-kcal_100g"] ??
            n["energy-kcal"] ??
            NaN
        );


    const protein =
        Number(
            n["proteins_100g"] ??
            n["protein_100g"] ??
            0
        );


    const carbs =
        Number(
            n["carbohydrates_100g"] ??
            n["carbohydrates"] ??
            0
        );


    const fat =
        Number(
            n["fat_100g"] ??
            n["fat"] ??
            0
        );


    return {

        calories:
            Number.isFinite(calories)
                ? calories
                : null,

        protein:
            Number.isFinite(protein)
                ? protein
                : 0,

        carbs:
            Number.isFinite(carbs)
                ? carbs
                : 0,

        fat:
            Number.isFinite(fat)
                ? fat
                : 0

    };

}


/* =========================================================
   SELECT FOOD
   ========================================================= */

function selectFood(product) {

    selectedFood = {

        code: product.code || "",

        name: product.product_name || "Food",

        brand: product.brands || "Unknown brand",

        image:
            product.image_front_small_url || "",

        nutrition:
            getNutrition(product)

    };


    document.getElementById("searchMode")
        .classList.add("hidden");

    document.getElementById("foodEditor")
        .classList.remove("hidden");


    document.getElementById("selectedName")
        .textContent =
        selectedFood.name;


    document.getElementById("selectedBrand")
        .textContent =
        selectedFood.brand;


    document.getElementById("selectedImage")
        .src =
        selectedFood.image;


    document.getElementById("amount")
        .value = 100;


    updateNutritionPreview();

}


document.getElementById("amount")
    .addEventListener(
        "input",
        updateNutritionPreview
    );


function updateNutritionPreview() {

    if (!selectedFood) return;


    const grams =
        Number(
            document.getElementById("amount")
                .value
        ) || 0;


    const multiplier =
        grams / 100;


    const n =
        selectedFood.nutrition;


    document.getElementById("nutritionPreview")
        .innerHTML = `

            <div class="nutrition-box">
                <strong>${Math.round(n.calories * multiplier)}</strong>
                <span>kcal</span>
            </div>

            <div class="nutrition-box">
                <strong>${Math.round(n.protein * multiplier)}g</strong>
                <span>protein</span>
            </div>

            <div class="nutrition-box">
                <strong>${Math.round(n.carbs * multiplier)}g</strong>
                <span>carbs</span>
            </div>

            <div class="nutrition-box">
                <strong>${Math.round(n.fat * multiplier)}g</strong>
                <span>fat</span>
            </div>

        `;

}


/* =========================================================
   CONFIRM FOOD
   ========================================================= */

document.getElementById("confirmAdd")
    .addEventListener(
        "click",
        () => {

            if (!selectedFood) return;


            const amount =
                Number(
                    document.getElementById("amount")
                        .value
                );


            const meal =
                document.getElementById("mealType")
                    .value;


            if (!amount || amount <= 0) {

                showToast("Enter an amount");

                return;

            }


            const multiplier =
                amount / 100;


            foodLog.push({

                id: Date.now(),

                date: todayKey(),

                name: selectedFood.name,

                brand: selectedFood.brand,

                amount,

                meal,

                calories:
                    selectedFood.nutrition.calories *
                    multiplier,

                protein:
                    selectedFood.nutrition.protein *
                    multiplier,

                carbs:
                    selectedFood.nutrition.carbs *
                    multiplier,

                fat:
                    selectedFood.nutrition.fat *
                    multiplier

            });


            save(
                "calorieLog",
                foodLog
            );


            updateDashboard();

            closeModal();

            showToast("Food added");

        }
    );


document.getElementById("changeFood")
    .addEventListener(
        "click",
        () => {

            document.getElementById("foodEditor")
                .classList.add("hidden");

            document.getElementById("searchMode")
                .classList.remove("hidden");

        }
    );


/* =========================================================
   FAVOURITES
   ========================================================= */

function toggleFavourite(product) {

    const code =
        product.code || "";


    if (!code) {

        showToast("This food has no barcode");

        return;

    }


    const exists =
        favourites.some(
            food => food.code === code
        );


    if (exists) {

        favourites =
            favourites.filter(
                food => food.code !== code
            );

        showToast("Removed from favourites");

    } else {

        favourites.push({

            code,

            name:
                product.product_name || "Food",

            brand:
                product.brands || "Unknown brand",

            image:
                product.image_front_small_url || "",

            nutrition:
                getNutrition(product)

        });

        showToast("Added to favourites");

    }


    save(
        "favouriteFoods",
        favourites
    );


    const search =
        document.getElementById("foodSearch")
            .value.trim();


    if (search) {

        searchFoods();

    }


    if (
        document.getElementById("foodsPage")
            .classList.contains("active")
    ) {

        renderFoodLibrary();

    }

}


/* =========================================================
   BARCODE SEARCH
   ========================================================= */

document.getElementById("barcodeSearchBtn")
    .addEventListener(
        "click",
        searchBarcode
    );


async function searchBarcode() {

    const code =
        document.getElementById("barcodeInput")
            .value
            .trim();


    if (!code) {

        showToast("Enter a barcode");

        return;

    }


    const results =
        document.getElementById("barcodeResults");


    results.innerHTML =
        `<div class="chart-empty">Searching barcode...</div>`;


    try {

        const response =
            await fetch(
                `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`
            );


        const data =
            await response.json();


        if (
            data.status !== 1 ||
            !data.product
        ) {

            results.innerHTML =
                `<div class="chart-empty">
                    Food not found.
                </div>`;

            return;

        }


        const product =
            data.product;


        const nutrition =
            getNutrition(product);


        if (nutrition.calories === null) {

            results.innerHTML =
                `<div class="chart-empty">
                    Food found, but nutrition information is incomplete.
                </div>`;

            return;

        }


        results.innerHTML = `
            <div class="result-card">

                <img
                    src="${product.image_front_small_url || ""}"
                    alt=""
                >

                <div class="result-info">
                    <strong>
                        ${escapeHtml(product.product_name || "Food")}
                    </strong>

                    <span>
                        ${escapeHtml(product.brands || "")}
                    </span>

                    <span>
                        ${Math.round(nutrition.calories)} kcal / 100g
                    </span>
                </div>

                <button id="useBarcodeFood" class="primary-btn">
                    Add
                </button>

            </div>
        `;


        document.getElementById("useBarcodeFood")
            .addEventListener(
                "click",
                () => selectFood(product)
            );


    } catch {

        results.innerHTML =
            `<div class="chart-empty">
                Barcode search failed.
            </div>`;

    }

}


/* =========================================================
   BARCODE CAMERA
   ========================================================= */

document.getElementById("startScanner")
    .addEventListener(
        "click",
        startScanner
    );


document.getElementById("stopScanner")
    .addEventListener(
        "click",
        stopScanner
    );


async function startScanner() {

    if (!("BarcodeDetector" in window)) {

        showToast(
            "Camera barcode scanning isn't supported here. Enter the barcode manually."
        );

        return;

    }


    try {

        scannerStream =
            await navigator.mediaDevices
                .getUserMedia({
                    video: {
                        facingMode: {
                            ideal: "environment"
                        }
                    }
                });


        const video =
            document.getElementById("barcodeVideo");


        video.srcObject =
            scannerStream;


        video.classList.remove("hidden");

        document.getElementById("stopScanner")
            .classList.remove("hidden");


        const detector =
            new BarcodeDetector({
                formats: [
                    "ean_13",
                    "ean_8",
                    "upc_a",
                    "upc_e"
                ]
            });


        scanBarcodeFrame(detector);

    } catch (error) {

        console.error(error);

        showToast(
            "Camera permission was not available."
        );

    }

}


async function scanBarcodeFrame(detector) {

    const video =
        document.getElementById("barcodeVideo");


    if (
        !scannerStream ||
        video.readyState < 2
    ) {

        if (scannerStream) {

            requestAnimationFrame(
                () => scanBarcodeFrame(detector)
            );

        }

        return;

    }


    try {

        const codes =
            await detector.detect(video);


        if (codes.length) {

            const value =
                codes[0].rawValue;


            document.getElementById("barcodeInput")
                .value = value;


            showToast("Barcode detected");

            await searchBarcode();

            stopScanner();

            return;

        }

    } catch (error) {

        console.log(error);

    }


    requestAnimationFrame(
        () => scanBarcodeFrame(detector)
    );

}


function stopScanner() {

    if (scannerStream) {

        scannerStream
            .getTracks()
            .forEach(track => track.stop());

        scannerStream = null;

    }


    const video =
        document.getElementById("barcodeVideo");


    video.srcObject = null;

    video.classList.add("hidden");


    document.getElementById("stopScanner")
        .classList.add("hidden");

}


/* =========================================================
   QUICK ADD
   ========================================================= */

document.getElementById("addQuick")
    .addEventListener(
        "click",
        addQuickFood
    );


function addQuickFood() {

    const name =
        document.getElementById("quickName")
            .value.trim() ||
        "Quick add";


    const calories =
        Number(
            document.getElementById("quickCalories")
                .value
        ) || 0;


    const protein =
        Number(
            document.getElementById("quickProtein")
                .value
        ) || 0;


    const carbs =
        Number(
            document.getElementById("quickCarbs")
                .value
        ) || 0;


    const fat =
        Number(
            document.getElementById("quickFat")
                .value
        ) || 0;


    const meal =
        document.getElementById("quickMeal")
            .value;


    if (calories <= 0) {

        showToast("Enter calories");

        return;

    }


    foodLog.push({

        id: Date.now(),

        date: todayKey(),

        name,

        amount: null,

        meal,

        calories,

        protein,

        carbs,

        fat

    });


    save(
        "calorieLog",
        foodLog
    );


    updateDashboard();

    closeModal();

    showToast("Quick add saved");

}


/* =========================================================
   CUSTOM FOODS
   ========================================================= */

document.getElementById("addManual")
    .addEventListener(
        "click",
        addCustomFood
    );


function addCustomFood() {

    const name =
        document.getElementById("manualName")
            .value.trim();


    const kcal =
        Number(
            document.getElementById("manualKcal")
                .value
        );


    const protein =
        Number(
            document.getElementById("manualProtein")
                .value
        ) || 0;


    const carbs =
        Number(
            document.getElementById("manualCarbs")
                .value
        ) || 0;


    const fat =
        Number(
            document.getElementById("manualFat")
                .value
        ) || 0;


    const amount =
        Number(
            document.getElementById("manualAmount")
                .value
        );


    const meal =
        document.getElementById("manualMeal")
            .value;


    if (!name || !kcal || !amount) {

        showToast("Fill in the required fields");

        return;

    }


    const custom = {

        id: Date.now(),

        name,

        calories100: kcal,

        protein100: protein,

        carbs100: carbs,

        fat100: fat

    };


    customFoods.push(custom);

    save(
        "customFoods",
        customFoods
    );


    const multiplier =
        amount / 100;


    foodLog.push({

        id: Date.now() + 1,

        date: todayKey(),

        name,

        amount,

        meal,

        calories: kcal * multiplier,

        protein: protein * multiplier,

        carbs: carbs * multiplier,

        fat: fat * multiplier

    });


    save(
        "calorieLog",
        foodLog
    );


    updateDashboard();

    closeModal();

    showToast("Custom food saved");

}


/* =========================================================
   SAVED MEALS
   ========================================================= */

function saveCurrentMeal(mealName) {

    const foods =
        todayFoods();


    if (!foods.length) {

        showToast("No food to save");

        return;

    }


    savedMeals.push({

        id: Date.now(),

        name: mealName,

        foods: foods.map(
            food => ({

                name: food.name,

                amount: food.amount,

                calories: food.calories,

                protein: food.protein,

                carbs: food.carbs,

                fat: food.fat

            })
        )

    });


    save(
        "savedMeals",
        savedMeals
    );

}


function addSavedMeal(meal) {

    const mealType =
        prompt(
            "Add this meal as Breakfast, Lunch, Dinner or Snacks:",
            "Lunch"
        );


    if (!mealType) return;


    const valid = [
        "Breakfast",
        "Lunch",
        "Dinner",
        "Snacks"
    ];


    if (!valid.includes(mealType)) {

        showToast("Invalid meal type");

        return;

    }


    meal.foods.forEach(food => {

        foodLog.push({

            id: Date.now() +
                Math.random(),

            date: todayKey(),

            name: food.name,

            amount: food.amount,

            meal: mealType,

            calories: food.calories,

            protein: food.protein,

            carbs: food.carbs,

            fat: food.fat

        });

    });


    save(
        "calorieLog",
        foodLog
    );


    updateDashboard();

    showToast("Saved meal added");

}


/* =========================================================
   FOOD LIBRARY
   ========================================================= */

document.querySelectorAll(".food-tab")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                currentFoodTab =
                    button.dataset.foodtab;


                document.querySelectorAll(".food-tab")
                    .forEach(tab =>
                        tab.classList.remove("active")
                    );


                button.classList.add("active");

                renderFoodLibrary();

            }
        );

    });


function renderFoodLibrary() {

    const container =
        document.getElementById("foodLibrary");


    container.innerHTML = "";


    if (currentFoodTab === "favourites") {

        if (!favourites.length) {

            container.innerHTML =
                `<div class="chart-empty">
                    No favourite foods yet.
                </div>`;

            return;

        }


        favourites.forEach(food => {

            renderLibraryFood(
                container,
                food
            );

        });

        return;

    }


    if (currentFoodTab === "saved") {

        if (!savedMeals.length) {

            container.innerHTML =
                `<div class="chart-empty">
                    No saved meals yet.
                </div>`;

            return;

        }


        savedMeals.forEach(meal => {

            const item =
                document.createElement("div");

            item.className =
                "library-item";


            const calories =
                meal.foods.reduce(
                    (sum, food) =>
                        sum + Number(food.calories || 0),
                    0
                );


            item.innerHTML = `
                <div class="library-main">
                    <strong>${escapeHtml(meal.name)}</strong>
                    <span>
                        ${meal.foods.length} foods ·
                        ${Math.round(calories)} kcal
                    </span>
                </div>

                <button class="primary-btn">
                    Add
                </button>
            `;


            item.querySelector("button")
                .addEventListener(
                    "click",
                    () => addSavedMeal(meal)
                );


            container.appendChild(item);

        });

        return;

    }


    if (currentFoodTab === "custom") {

        if (!customFoods.length) {

            container.innerHTML =
                `<div class="chart-empty">
                    No custom foods yet.
                </div>`;

            return;

        }


        customFoods.forEach(food => {

            const item =
                document.createElement("div");

            item.className =
                "library-item";


            item.innerHTML = `
                <div class="library-main">
                    <strong>${escapeHtml(food.name)}</strong>

                    <span>
                        ${Math.round(food.calories100)} kcal /
                        100g ·
                        P ${Math.round(food.protein100)}g ·
                        C ${Math.round(food.carbs100)}g ·
                        F ${Math.round(food.fat100)}g
                    </span>
                </div>

                <button class="primary-btn">
                    Add
                </button>
            `;


            item.querySelector("button")
                .addEventListener(
                    "click",
                    () => {

                        foodLog.push({

                            id: Date.now(),

                            date: todayKey(),

                            name: food.name,

                            amount: 100,

                            meal: "Snacks",

                            calories: food.calories100,

                            protein: food.protein100,

                            carbs: food.carbs100,

                            fat: food.fat100

                        });


                        save(
                            "calorieLog",
                            foodLog
                        );


                        updateDashboard();

                        showToast("Custom food added");

                    }
                );


            container.appendChild(item);

        });

    }

}


function renderLibraryFood(container, food) {

    const item =
        document.createElement("div");

    item.className = "library-item";


    item.innerHTML = `

        <img
            class="library-image"
            src="${food.image || ""}"
            alt=""
        >

        <div class="library-main">

            <strong>
                ${escapeHtml(food.name)}
            </strong>

            <span>
                ${escapeHtml(food.brand || "")}
            </span>

            <span>
                ${Math.round(food.nutrition.calories)}
                kcal / 100g
            </span>

        </div>

        <button class="primary-btn">
            Add
        </button>

    `;


    item.querySelector("button")
        .addEventListener(
            "click",
            () => {

                selectFood({

                    code: food.code,

                    product_name: food.name,

                    brands: food.brand,

                    image_front_small_url: food.image,

                    nutriments: {

                        "energy-kcal_100g":
                            food.nutrition.calories,

                        "proteins_100g":
                            food.nutrition.protein,

                        "carbohydrates_100g":
                            food.nutrition.carbs,

                        "fat_100g":
                            food.nutrition.fat

                    }

                });


                openModal();

            }
        );


    container.appendChild(item);

}


/* =========================================================
   PROGRESS
   ========================================================= */

document.querySelectorAll(".range-btn")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                progressRange =
                    Number(
                        button.dataset.range
                    );


                document.querySelectorAll(".range-btn")
                    .forEach(btn =>
                        btn.classList.remove("active")
                    );


                button.classList.add("active");

                renderProgress();

            }
        );

    });


function renderProgress() {

    const dates =
        getDateKeys(progressRange);


    const data =
        dates.map(
            date => ({

                date,

                ...totalsForDate(date)

            })
        );


    const logged =
        data.filter(
            day => day.count > 0
        );


    const averageCalories =
        logged.length
            ? logged.reduce(
                (sum, day) =>
                    sum + day.calories,
                0
            ) / logged.length
            : 0;


    const averageProtein =
        logged.length
            ? logged.reduce(
                (sum, day) =>
                    sum + day.protein,
                0
            ) / logged.length
            : 0;


    const foodsLogged =
        data.reduce(
            (sum, day) =>
                sum + day.count,
            0
        );


    document.getElementById("averageCalories")
        .textContent =
        Math.round(averageCalories);


    document.getElementById("averageProtein")
        .textContent =
        `${Math.round(averageProtein)}g`;


    document.getElementById("daysLogged")
        .textContent =
        logged.length;


    document.getElementById("foodsLogged")
        .textContent =
        foodsLogged;


    renderCalorieChart(data);

    renderMacroChart(data);

    renderHistory(data);

}


/* =========================================================
   CALORIE CHART
   ========================================================= */

function renderCalorieChart(data) {

    const container =
        document.getElementById("calorieChart");


    const max =
        Math.max(
            goals.calories,
            ...data.map(day => day.calories),
            1
        );


    container.innerHTML = `
        <div class="chart-bars">
            ${data.map(day => {

                const height =
                    day.calories / max * 100;

                const label =
                    dateFromKey(day.date)
                        .toLocaleDateString(
                            undefined,
                            {
                                weekday: "short"
                            }
                        )
                        .slice(0, 2);


                return `
                    <div class="chart-column">

                        <div
                            class="bar"
                            style="height:${Math.max(height, 1)}%"
                            title="${Math.round(day.calories)} kcal"
                        ></div>

                        <span class="bar-label">
                            ${label}
                        </span>

                    </div>
                `;

            }).join("")}
        </div>
    `;

}


/* =========================================================
   MACRO CHART
   ========================================================= */

function renderMacroChart(data) {

    const container =
        document.getElementById("macroChart");


    const average = {

        protein:
            data.reduce(
                (sum, day) =>
                    sum + day.protein,
                0
            ) / data.length,

        carbs:
            data.reduce(
                (sum, day) =>
                    sum + day.carbs,
                0
            ) / data.length,

        fat:
            data.reduce(
                (sum, day) =>
                    sum + day.fat,
                0
            ) / data.length

    };


    const rows = [

        {
            name: "Protein",
            value: average.protein,
            target: goals.protein
        },

        {
            name: "Carbs",
            value: average.carbs,
            target: goals.carbs
        },

        {
            name: "Fat",
            value: average.fat,
            target: goals.fat
        }

    ];


    container.innerHTML =
        rows.map(row => {

            const percentage =
                row.target > 0
                    ? Math.min(
                        row.value / row.target * 100,
                        100
                    )
                    : 0;


            return `
                <div class="macro-chart-row">

                    <span>
                        ${row.name}
                    </span>

                    <div class="macro-line">
                        <div
                            style="width:${percentage}%"
                        ></div>
                    </div>

                    <span>
                        ${Math.round(row.value)}g
                    </span>

                </div>
            `;

        }).join("");

}


/* =========================================================
   HISTORY
   ========================================================= */

function renderHistory(data) {

    const container =
        document.getElementById("historyList");


    container.innerHTML = "";


    [...data]
        .reverse()
        .forEach(day => {

            const row =
                document.createElement("div");

            row.className =
                "history-row";


            row.innerHTML = `

                <div class="history-date">

                    ${dateLabel(day.date)}

                    <span>
                        ${day.count} food${day.count === 1 ? "" : "s"}
                    </span>

                </div>

                <div class="history-value">

                    <strong>
                        ${Math.round(day.calories)} kcal
                    </strong>

                    <span>
                        P ${Math.round(day.protein)}g ·
                        C ${Math.round(day.carbs)}g ·
                        F ${Math.round(day.fat)}g
                    </span>

                </div>

            `;


            container.appendChild(row);

        });

}


/* =========================================================
   GOALS
   ========================================================= */

function loadGoalInputs() {

    document.getElementById("goalCalories")
        .value =
        goals.calories;


    document.getElementById("goalProtein")
        .value =
        goals.protein;


    document.getElementById("goalCarbs")
        .value =
        goals.carbs;


    document.getElementById("goalFat")
        .value =
        goals.fat;

}


document.getElementById("saveGoals")
    .addEventListener(
        "click",
        () => {

            goals = {

                calories:
                    Number(
                        document.getElementById("goalCalories")
                            .value
                    ) || 0,

                protein:
                    Number(
                        document.getElementById("goalProtein")
                            .value
                    ) || 0,

                carbs:
                    Number(
                        document.getElementById("goalCarbs")
                            .value
                    ) || 0,

                fat:
                    Number(
                        document.getElementById("goalFat")
                            .value
                    ) || 0

            };


            save(
                "calorieGoals",
                goals
            );


            updateDashboard();

            showToast("Targets saved");

        }
    );


/* =========================================================
   CLEAR TODAY
   ========================================================= */

document.getElementById("clearToday")
    .addEventListener(
        "click",
        () => {

            if (
                !confirm(
                    "Clear all foods logged today?"
                )
            ) {

                return;

            }


            foodLog =
                foodLog.filter(
                    food =>
                        food.date !== todayKey()
                );


            save(
                "calorieLog",
                foodLog
            );


            updateDashboard();

            showToast("Today's foods cleared");

        }
    );


/* =========================================================
   EXPORT DATA
   ========================================================= */

document.getElementById("exportData")
    .addEventListener(
        "click",
        () => {

            const data = {

                goals,

                foodLog,

                favourites,

                savedMeals,

                customFoods

            };


            const blob =
                new Blob(
                    [
                        JSON.stringify(
                            data,
                            null,
                            2
                        )
                    ],
                    {
                        type: "application/json"
                    }
                );


            const url =
                URL.createObjectURL(blob);


            const link =
                document.createElement("a");


            link.href = url;

            link.download =
                "nutritrack-backup.json";


            link.click();


            URL.revokeObjectURL(url);

        }
    );


/* =========================================================
   DELETE ALL DATA
   ========================================================= */

document.getElementById("clearAllData")
    .addEventListener(
        "click",
        () => {

            if (
                !confirm(
                    "This will permanently remove your food log, favourites, saved meals and custom foods. Continue?"
                )
            ) {

                return;

            }


            localStorage.removeItem(
                "calorieGoals"
            );

            localStorage.removeItem(
                "calorieLog"
            );

            localStorage.removeItem(
                "favouriteFoods"
            );

            localStorage.removeItem(
                "savedMeals"
            );

            localStorage.removeItem(
                "customFoods"
            );


            goals =
                {...defaultGoals};

            foodLog = [];

            favourites = [];

            savedMeals = [];

            customFoods = [];


            updateDashboard();

            showToast("All data deleted");

        }
    );


/* =========================================================
   PWA INSTALL
   ========================================================= */

window.addEventListener(
    "beforeinstallprompt",
    event => {

        event.preventDefault();

        deferredInstallPrompt = event;

        document.getElementById("installBtn")
            .classList.remove("hidden");

    }
);


document.getElementById("installBtn")
    .addEventListener(
        "click",
        async () => {

            if (!deferredInstallPrompt) {

                return;

            }


            deferredInstallPrompt.prompt();

            await deferredInstallPrompt.userChoice;

            deferredInstallPrompt = null;

            document.getElementById("installBtn")
                .classList.add("hidden");

        }
    );


/* =========================================================
   SERVICE WORKER
   ========================================================= */

if ("serviceWorker" in navigator) {

    window.addEventListener(
        "load",
        () => {

            navigator.serviceWorker
                .register("sw.js")
                .then(
                    () => console.log(
                        "Service worker registered"
                    )
                )
                .catch(
                    error =>
                        console.error(
                            "Service worker error:",
                            error
                        )
                );

        }
    );

}


/* =========================================================
   HELPERS
   ========================================================= */

function showToast(message) {

    const toast =
        document.getElementById("toast");


    toast.textContent =
        message;


    toast.classList.add("show");


    clearTimeout(
        window.toastTimer
    );


    window.toastTimer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            2200
        );

}


function escapeHtml(value) {

    return String(value ?? "")
        .replace(
            /[&<>"']/g,
            character => ({

                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"

            })[character]
        );

}


/* =========================================================
   SAVE CURRENT DAY AS MEAL
   ========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.ctrlKey &&
            event.key.toLowerCase() === "s"
        ) {

            event.preventDefault();

        }

    }
);


/* =========================================================
   START
   ========================================================= */

updateDashboard();

loadGoalInputs();