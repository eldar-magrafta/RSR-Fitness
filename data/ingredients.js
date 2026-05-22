// ── Nutrition Lab Ingredients Database ──
// Macro values are per 100g, except for items with `unit:'ml'` which are per 100ml.
// Values are aligned with FatSecret (foods.fatsecret.com). Note: cal is FatSecret's
// reported value, which can differ from p·4 + c·4 + f·9 because fiber counts toward
// carbs but contributes ~0 kcal.
// Ingredients are grouped by image folder. Each array's `img` field is just the
// filename — the folder prefix is applied at the bottom when building NL_INGREDIENTS.

const MEAT_DIR = 'assets/foods/meat/';
const MEAT = [
  {name:'Chicken Breast (cooked)',cat:'protein',p:31,c:0,f:3.6,cal:165,img:'chicken-breast.jpg'},
  {name:'Ground Beef lean (cooked)',cat:'protein',p:26,c:0,f:15,cal:254,img:'ground-beef.jpg'},
  {name:'Turkey Breast (cooked)',cat:'protein',p:30,c:0,f:1,cal:135,img:'turkey-breast.jpg'},
  {name:'Beef Steak Sirloin (cooked)',cat:'protein',p:29,c:0,f:8,cal:201,img:'beef-steak.jpg'},
  {name:'Chicken Thigh (cooked)',cat:'protein',p:25,c:0,f:10.9,cal:209,img:'chicken-thigh.jpg'},
  {name:'Beef Brisket (cooked)',cat:'protein',p:28,c:0,f:13,cal:236,img:'beef-brisket.jpg'},
  {name:'Chicken Drumstick (cooked)',cat:'protein',p:28.3,c:0,f:5.7,cal:172,img:'chicken-drumstick.jpg'},
  {name:'Chicken Wing (cooked)',cat:'protein',p:30.5,c:0,f:8.1,cal:203,img:'chicken-wing.jpg'},
  {name:'Duck Breast (cooked)',cat:'protein',p:23.5,c:0,f:2,cal:123,img:'duck-breast.jpg'},
  {name:'Ground Turkey (cooked)',cat:'protein',p:27,c:0,f:8,cal:189,img:'ground-turkey.jpg'},
  {name:'Lamb (cooked)',cat:'protein',p:25,c:0,f:9,cal:206,img:'lamb.jpg'},
  {name:'Ribeye Steak (cooked)',cat:'protein',p:24,c:0,f:18,cal:271,img:'ribeye-steak.jpg'},
  {name:'Veal (cooked)',cat:'protein',p:31,c:0,f:6,cal:172,img:'veal.jpg'},
  {name:'Ground Chicken (cooked)',cat:'protein',p:27,c:0,f:11,cal:219,img:'ground-chicken.jpg'},
];

const SEAFOOD_DIR = 'assets/foods/seafood/';
const SEAFOOD = [
  {name:'Salmon (cooked)',cat:'protein',p:22,c:0,f:13,cal:208,img:'salmon.jpg'},
  {name:'Tuna (canned in water)',cat:'protein',p:26,c:0,f:1,cal:116,img:'tuna.jpg'},
  {name:'Tilapia (cooked)',cat:'protein',p:26,c:0,f:2.7,cal:128,img:'tilapia.jpg'},
  {name:'Sardines (canned in oil)',cat:'protein',p:25,c:0,f:11,cal:208,img:'sardines.jpg'},
  {name:'Cod (cooked)',cat:'protein',p:23,c:0,f:0.9,cal:105,img:'cod.jpg'},
  {name:'Halibut (cooked)',cat:'protein',p:23,c:0,f:2.3,cal:111,img:'halibut.jpg'},
  {name:'Mackerel (cooked)',cat:'protein',p:24,c:0,f:18,cal:262,img:'mackerel.jpg'},
  {name:'Sea Bass (cooked)',cat:'protein',p:24,c:0,f:2.6,cal:124,img:'sea-bass.jpg'},
  {name:'Trout (cooked)',cat:'protein',p:23,c:0,f:7.2,cal:168,img:'trout.jpg'},
  {name:'Anchovies (canned)',cat:'protein',p:29,c:0,f:10,cal:210,img:'anchovies.jpg'},
];

const DAIRY_DIR = 'assets/foods/dairy/';
const DAIRY = [
  {name:'Eggs (whole, cooked)',cat:'protein',p:13,c:1.1,f:11,cal:155,img:'eggs.jpg'},
  {name:'Egg Whites (cooked)',cat:'protein',p:11,c:0.7,f:0.2,cal:52,img:'egg-whites.jpg'},
  {name:'Greek Yogurt (plain, nonfat)',cat:'dairy',p:10,c:3.6,f:0.4,cal:59,img:'greek-yogurt.jpg'},
  {name:'Plain Yogurt (whole milk)',cat:'dairy',p:3.5,c:4.7,f:3.3,cal:61,img:'plain-yogurt.jpg'},
  {name:'Heavy Cream (36%)',cat:'fats',unit:'ml',p:2.8,c:2.8,f:36,cal:340,img:'heavy-cream.jpg'},
  {name:'Cottage Cheese',cat:'dairy',p:11,c:3.4,f:4.3,cal:98,img:'cottage-cheese.jpg'},
  {name:'Whole Milk',cat:'dairy',unit:'ml',p:3.2,c:4.7,f:3.4,cal:61,img:'whole-milk.jpg'},
  {name:'Skim Milk',cat:'dairy',unit:'ml',p:3.4,c:5,f:0.1,cal:34,img:'skim-milk.jpg'},
  {name:'Cheddar Cheese',cat:'dairy',p:25,c:1.3,f:33,cal:402,img:'cheddar-cheese.jpg'},
  {name:'Mozzarella',cat:'dairy',p:22,c:2.2,f:22,cal:300,img:'mozzarella.jpg'},
  {name:'Parmesan',cat:'dairy',p:38,c:4.1,f:29,cal:431,img:'parmesan.jpg'},
  {name:'Cream Cheese',cat:'dairy',p:6.2,c:4.1,f:34,cal:342,img:'cream-cheese.jpg'},
  {name:'Feta Cheese',cat:'dairy',p:14,c:4.1,f:21,cal:264,img:'feta-cheese.jpg'},
  {name:'Ricotta Cheese',cat:'dairy',p:11,c:3.0,f:13,cal:174,img:'ricotta.jpg'},
  {name:'Butter',cat:'fats',p:0.9,c:0.1,f:81,cal:717,img:'butter.jpg'},
  {name:'Coconut Milk (canned)',cat:'other',unit:'ml',p:2.3,c:3.3,f:24,cal:230,img:'coconut-milk.jpg'},
  {name:'Oat Milk',cat:'other',unit:'ml',p:1,c:6.7,f:1.5,cal:43,img:'oat-milk.jpg'},
  {name:'Almond Milk (unsweetened)',cat:'other',unit:'ml',p:0.4,c:0.3,f:1.1,cal:13,img:'almond-milk.jpg'},
  {name:'Soy Milk (unsweetened)',cat:'other',unit:'ml',p:3.3,c:1.8,f:1.8,cal:33,img:'soy-milk.jpg'},
];

const GRAINS_DIR = 'assets/foods/grains/';
const GRAINS = [
  {name:'White Rice (cooked)',cat:'carbs',p:2.7,c:28,f:0.3,cal:130,img:'white-rice.jpg'},
  {name:'Brown Rice (cooked)',cat:'carbs',p:2.6,c:23,f:0.9,cal:111,img:'brown-rice.jpg'},
  {name:'Oats',cat:'carbs',p:13,c:67,f:7,cal:389,img:'oats.jpg'},
  {name:'Pasta (cooked)',cat:'carbs',p:5.8,c:25,f:0.9,cal:131,img:'pasta.jpg'},
  {name:'White Bread',cat:'carbs',p:9,c:49,f:3.2,cal:265,img:'white-bread.jpg'},
  {name:'Whole Wheat Bread',cat:'carbs',p:13,c:43,f:3.4,cal:247,img:'whole-wheat-bread.jpg'},
  {name:'Quinoa (cooked)',cat:'carbs',p:4.4,c:21.3,f:1.9,cal:120,img:'quinoa.jpg'},
  {name:'Corn Tortilla',cat:'carbs',p:5.7,c:44,f:3,cal:218,img:'corn-tortilla.jpg'},
  {name:'Bagel',cat:'carbs',p:11,c:53,f:1.6,cal:257,img:'bagel.jpg'},
  {name:'Pita Bread',cat:'carbs',p:9,c:55,f:1.2,cal:275,img:'pita-bread.jpg'},
  {name:'Couscous (cooked)',cat:'carbs',p:3.8,c:23,f:0.2,cal:112,img:'couscous.jpg'},
  {name:'Cornflakes',cat:'carbs',p:7.5,c:84,f:0.4,cal:357,img:'cornflakes.jpg'},
  {name:'Flour (all-purpose)',cat:'carbs',p:10,c:76,f:1,cal:364,img:'flour.jpg'},
  {name:'Cornmeal',cat:'carbs',p:7,c:79,f:3.6,cal:384,img:'cornmeal.jpg'},
  {name:'Rice Noodles (cooked)',cat:'carbs',p:1.6,c:25,f:0.2,cal:109,img:'rice-noodles.jpg'},
  {name:'Egg Noodles (cooked)',cat:'carbs',p:4.5,c:25,f:1.5,cal:138,img:'egg-noodles.jpg'},
  {name:'Bulgur (cooked)',cat:'carbs',p:3.1,c:18.6,f:0.2,cal:83,img:'bulgur.jpg'},
  {name:'Polenta (cooked)',cat:'carbs',p:2.1,c:13,f:0.3,cal:71,img:'polenta.jpg'},
  {name:'Granola',cat:'other',p:10,c:64,f:14,cal:471,img:'granola.jpg'},
  {name:'Popcorn (air-popped)',cat:'other',p:11,c:74,f:5,cal:387,img:'popcorn.jpg'},
  {name:'Tortilla Wrap (flour)',cat:'other',p:8,c:50,f:7,cal:312,img:'flour-tortilla.jpg'},
];

const FRUITS_DIR = 'assets/foods/fruits/';
const FRUITS = [
  {name:'Banana',cat:'carbs',p:1.1,c:23,f:0.3,cal:89,img:'banana.jpg'},
  {name:'Apple',cat:'carbs',p:0.3,c:14,f:0.2,cal:52,img:'apple.jpg'},
  {name:'Orange',cat:'carbs',p:0.9,c:12,f:0.1,cal:47,img:'orange.jpg'},
  {name:'Strawberries',cat:'carbs',p:0.7,c:7.7,f:0.3,cal:32,img:'strawberries.jpg'},
  {name:'Blueberries',cat:'carbs',p:0.7,c:14,f:0.3,cal:57,img:'blueberries.jpg'},
  {name:'Mango',cat:'carbs',p:0.8,c:15,f:0.4,cal:60,img:'mango.jpg'},
  {name:'Grapes',cat:'carbs',p:0.7,c:18,f:0.2,cal:69,img:'grapes.jpg'},
  {name:'Watermelon',cat:'carbs',p:0.6,c:7.6,f:0.2,cal:30,img:'watermelon.jpg'},
  {name:'Pineapple',cat:'carbs',p:0.5,c:13,f:0.1,cal:50,img:'pineapple.jpg'},
  {name:'Dates (dried)',cat:'carbs',p:2.5,c:75,f:0.4,cal:282,img:'dates.jpg'},
  {name:'Pear',cat:'carbs',p:0.4,c:15,f:0.1,cal:57,img:'pear.jpg'},
  {name:'Peach',cat:'carbs',p:0.9,c:10,f:0.3,cal:39,img:'peach.jpg'},
  {name:'Cherries',cat:'carbs',p:1.1,c:16,f:0.2,cal:63,img:'cherries.jpg'},
  {name:'Apricot',cat:'carbs',p:1.4,c:11,f:0.4,cal:48,img:'apricot.jpg'},
  {name:'Blackberries',cat:'carbs',p:1.4,c:10,f:0.5,cal:43,img:'blackberries.jpg'},
  {name:'Cantaloupe',cat:'carbs',p:0.8,c:8,f:0.2,cal:34,img:'cantaloupe.jpg'},
  {name:'Grapefruit',cat:'carbs',p:0.8,c:11,f:0.1,cal:42,img:'grapefruit.jpg'},
  {name:'Kiwi',cat:'carbs',p:1.1,c:15,f:0.5,cal:61,img:'kiwi.jpg'},
  {name:'Lemon',cat:'carbs',p:1.1,c:9,f:0.3,cal:29,img:'lemon.jpg'},
  {name:'Lime',cat:'carbs',p:0.7,c:11,f:0.2,cal:30,img:'lime.jpg'},
  {name:'Plum',cat:'carbs',p:0.7,c:11,f:0.3,cal:46,img:'plum.jpg'},
  {name:'Pomegranate',cat:'carbs',p:1.7,c:19,f:1.2,cal:83,img:'pomegranate.jpg'},
  {name:'Raisins',cat:'carbs',p:3.1,c:79,f:0.5,cal:299,img:'raisins.jpg'},
  {name:'Raspberries',cat:'carbs',p:1.2,c:12,f:0.7,cal:52,img:'raspberries.jpg'},
  {name:'Papaya',cat:'carbs',p:0.5,c:11,f:0.3,cal:43,img:'papaya.jpg'},
  {name:'Honeydew Melon',cat:'carbs',p:0.5,c:9,f:0.1,cal:36,img:'honeydew.jpg'},
  {name:'Fig (fresh)',cat:'carbs',p:0.8,c:19,f:0.3,cal:74,img:'fig.jpg'},
  {name:'Tangerine',cat:'carbs',p:0.8,c:13,f:0.3,cal:53,img:'tangerine.jpg'},
  {name:'Cranberries (fresh)',cat:'carbs',p:0.4,c:12,f:0.1,cal:46,img:'cranberries.jpg'},
  {name:'Coconut (raw)',cat:'fats',p:3.3,c:15,f:33,cal:354,img:'coconut.jpg'},
  {name:'Nectarine',cat:'carbs',p:1.1,c:11,f:0.3,cal:44,img:'nectarine.jpg'},
  {name:'Passion Fruit',cat:'carbs',p:2.2,c:23,f:0.7,cal:97,img:'passion-fruit.jpg'},
  {name:'Lychee',cat:'carbs',p:0.8,c:17,f:0.4,cal:66,img:'lychee.jpg'},
  {name:'Persimmon',cat:'carbs',p:0.6,c:19,f:0.2,cal:70,img:'persimmon.jpg'},
  {name:'Avocado',cat:'fats',p:2,c:8.5,f:14.7,cal:160,img:'avocado.jpg'},
];

const VEGETABLES_DIR = 'assets/foods/vegetables/';
const VEGETABLES = [
  {name:'Sweet Potato',cat:'carbs',p:1.6,c:20,f:0.1,cal:86,img:'sweet-potato.jpg'},
  {name:'Potato',cat:'carbs',p:2,c:17,f:0.1,cal:77,img:'potato.jpg'},
  {name:'Broccoli',cat:'vegetables',p:2.8,c:7,f:0.4,cal:34,img:'broccoli.jpg'},
  {name:'Spinach',cat:'vegetables',p:2.9,c:3.6,f:0.4,cal:23,img:'spinach.jpg'},
  {name:'Tomato',cat:'vegetables',p:0.9,c:3.9,f:0.2,cal:18,img:'tomato.jpg'},
  {name:'Cucumber',cat:'vegetables',p:0.7,c:3.6,f:0.1,cal:15,img:'cucumber.jpg'},
  {name:'Carrot',cat:'vegetables',p:0.9,c:10,f:0.2,cal:41,img:'carrot.jpg'},
  {name:'Bell Pepper (red)',cat:'vegetables',p:1,c:6,f:0.3,cal:31,img:'bell-pepper.jpg'},
  {name:'Onion',cat:'vegetables',p:1.1,c:9.3,f:0.1,cal:40,img:'onion.jpg'},
  {name:'Mushrooms',cat:'vegetables',p:3.1,c:3.3,f:0.3,cal:22,img:'mushrooms.jpg'},
  {name:'Zucchini',cat:'vegetables',p:1.2,c:3.1,f:0.3,cal:17,img:'zucchini.jpg'},
  {name:'Lettuce',cat:'vegetables',p:1.4,c:2.9,f:0.2,cal:15,img:'lettuce.jpg'},
  {name:'Kale',cat:'vegetables',p:4.3,c:8.8,f:0.9,cal:49,img:'kale.jpg'},
  {name:'Cauliflower',cat:'vegetables',p:1.9,c:5,f:0.3,cal:25,img:'cauliflower.jpg'},
  {name:'Asparagus',cat:'vegetables',p:2.2,c:3.9,f:0.1,cal:20,img:'asparagus.jpg'},
  {name:'Green Beans',cat:'vegetables',p:1.8,c:7,f:0.2,cal:31,img:'green-beans.jpg'},
  {name:'Cabbage',cat:'vegetables',p:1.3,c:5.8,f:0.1,cal:25,img:'cabbage.jpg'},
  {name:'Celery',cat:'vegetables',p:0.7,c:3,f:0.2,cal:16,img:'celery.jpg'},
  {name:'Eggplant',cat:'vegetables',p:1,c:6,f:0.2,cal:25,img:'eggplant.jpg'},
  {name:'Green Peas',cat:'vegetables',p:5.4,c:14,f:0.4,cal:81,img:'green-peas.jpg'},
  {name:'Corn (cooked)',cat:'vegetables',p:3.4,c:19,f:1.5,cal:96,img:'corn.jpg'},
  {name:'Garlic',cat:'vegetables',p:6.4,c:33,f:0.5,cal:149,img:'garlic.jpg'},
  {name:'Brussels Sprouts',cat:'vegetables',p:3.4,c:9,f:0.3,cal:43,img:'brussels-sprouts.jpg'},
  {name:'Artichoke (cooked)',cat:'vegetables',p:3.3,c:11.4,f:0.2,cal:53,img:'artichoke.jpg'},
  {name:'Beetroot',cat:'vegetables',p:1.6,c:9.6,f:0.2,cal:43,img:'beetroot.jpg'},
  {name:'Bok Choy',cat:'vegetables',p:1.5,c:2.2,f:0.2,cal:13,img:'bok-choy.jpg'},
  {name:'Leek',cat:'vegetables',p:1.5,c:14,f:0.3,cal:61,img:'leek.jpg'},
  {name:'Pumpkin (cooked)',cat:'vegetables',p:0.7,c:4.9,f:0.1,cal:20,img:'pumpkin.jpg'},
  {name:'Radish',cat:'vegetables',p:0.7,c:3.4,f:0.1,cal:16,img:'radish.jpg'},
  {name:'Scallions',cat:'vegetables',p:1.8,c:7.3,f:0.2,cal:32,img:'scallions.jpg'},
  {name:'Butternut Squash (cooked)',cat:'vegetables',p:0.9,c:11,f:0.1,cal:45,img:'butternut-squash.jpg'},
  {name:'Snow Peas',cat:'vegetables',p:2.8,c:7.5,f:0.2,cal:42,img:'snow-peas.jpg'},
  {name:'Ginger (fresh)',cat:'vegetables',p:1.8,c:18,f:0.8,cal:80,img:'ginger.jpg'},
  {name:'Kohlrabi',cat:'vegetables',p:1.7,c:6.2,f:0.1,cal:27,img:'kohlrabi.jpg'},
];

const LEGUMES_DIR = 'assets/foods/legumes/';
const LEGUMES = [
  {name:'Tofu (raw)',cat:'protein',p:8,c:1.9,f:4.8,cal:76,img:'tofu.jpg'},
  {name:'Edamame (cooked)',cat:'protein',p:11,c:9,f:5,cal:121,img:'edamame.jpg'},
  {name:'Tempeh',cat:'protein',p:19,c:9,f:11,cal:192,img:'tempeh.jpg'},
  {name:'Soybeans (cooked)',cat:'protein',p:17,c:8.4,f:9,cal:173,img:'soybeans.jpg'},
  {name:'Lima Beans (cooked)',cat:'other',p:7.8,c:21,f:0.4,cal:115,img:'lima-beans.jpg'},
  {name:'Black-Eyed Peas (cooked)',cat:'other',p:7.7,c:21,f:0.5,cal:116,img:'black-eyed-peas.jpg'},
  {name:'Hummus',cat:'other',p:8,c:14,f:10,cal:166,img:'hummus.jpg'},
  {name:'Chickpeas (cooked)',cat:'other',p:8.9,c:27,f:2.6,cal:164,img:'chickpeas.jpg'},
  {name:'Lentils (cooked)',cat:'other',p:9,c:20,f:0.4,cal:116,img:'lentils.jpg'},
  {name:'Black Beans (cooked)',cat:'other',p:8.9,c:24,f:0.5,cal:132,img:'black-beans.jpg'},
  {name:'Kidney Beans (cooked)',cat:'other',p:8.7,c:23,f:0.5,cal:127,img:'kidney-beans.jpg'},
];

const NUTS_AND_SEEDS_DIR = 'assets/foods/nuts-and-seeds/';
const NUTS_AND_SEEDS = [
  {name:'Almonds',cat:'fats',p:21,c:22,f:49,cal:579,img:'almonds.jpg'},
  {name:'Peanut Butter',cat:'fats',p:25,c:20,f:50,cal:588,img:'peanut-butter.jpg'},
  {name:'Walnuts',cat:'fats',p:15,c:14,f:65,cal:654,img:'walnuts.jpg'},
  {name:'Chia Seeds',cat:'fats',p:17,c:42,f:31,cal:486,img:'chia-seeds.jpg'},
  {name:'Flax Seeds',cat:'fats',p:18,c:29,f:42,cal:534,img:'flax-seeds.jpg'},
  {name:'Tahini',cat:'fats',p:17,c:21,f:54,cal:595,img:'tahini.jpg'},
  {name:'Almond Butter',cat:'fats',p:21,c:19,f:56,cal:614,img:'almond-butter.jpg'},
  {name:'Cashews',cat:'fats',p:18,c:30,f:44,cal:553,img:'cashews.jpg'},
  {name:'Pistachios',cat:'fats',p:20,c:28,f:45,cal:560,img:'pistachios.jpg'},
  {name:'Peanuts',cat:'fats',p:26,c:16,f:49,cal:567,img:'peanuts.jpg'},
  {name:'Sunflower Seeds',cat:'fats',p:21,c:20,f:51,cal:584,img:'sunflower-seeds.jpg'},
  {name:'Pumpkin Seeds',cat:'fats',p:30,c:11,f:49,cal:559,img:'pumpkin-seeds.jpg'},
  {name:'Macadamia Nuts',cat:'fats',p:7.9,c:14,f:76,cal:718,img:'macadamia-nuts.jpg'},
  {name:'Sesame Seeds',cat:'fats',p:18,c:23,f:50,cal:573,img:'sesame-seeds.jpg'},
  {name:'Pecans',cat:'fats',p:9.2,c:14,f:72,cal:691,img:'pecans.jpg'},
  {name:'Hazelnuts',cat:'fats',p:15,c:17,f:61,cal:628,img:'hazelnuts.jpg'},
  {name:'Brazil Nuts',cat:'fats',p:14,c:12,f:67,cal:656,img:'brazil-nuts.jpg'},
  {name:'Pine Nuts',cat:'fats',p:14,c:13,f:68,cal:673,img:'pine-nuts.jpg'},
  {name:'Coconut Flakes (unsweetened)',cat:'fats',p:6.9,c:24,f:65,cal:660,img:'coconut-flakes.jpg'},
];

const OILS_AND_CONDIMENTS_DIR = 'assets/foods/oils-and-condiments/';
const OILS_AND_CONDIMENTS = [
  {name:'Olive Oil',cat:'fats',p:0,c:0,f:100,cal:884,img:'olive-oil.jpg'},
  {name:'Coconut Oil',cat:'fats',p:0,c:0,f:100,cal:892,img:'coconut-oil.jpg'},
  {name:'Sesame Oil',cat:'fats',p:0,c:0,f:100,cal:884,img:'sesame-oil.jpg'},
  {name:'Avocado Oil',cat:'fats',p:0,c:0,f:100,cal:884,img:'avocado-oil.jpg'},
  {name:'Canola Oil',cat:'fats',p:0,c:0,f:100,cal:884,img:'canola-oil.jpg'},
  {name:'Sunflower Oil',cat:'fats',p:0,c:0,f:100,cal:884,img:'sunflower-oil.jpg'},
  {name:'Apple Cider Vinegar',cat:'other',unit:'ml',p:0,c:0.9,f:0,cal:22,img:'apple-cider-vinegar.jpg'},
  {name:'Honey',cat:'other',p:0.3,c:82,f:0,cal:304,img:'honey.jpg'},
  {name:'Maple Syrup',cat:'other',p:0,c:67,f:0.1,cal:260,img:'maple-syrup.jpg'},
  {name:'Soy Sauce',cat:'other',p:8,c:5,f:0.04,cal:53,img:'soy-sauce.jpg'},
  {name:'Sugar (white)',cat:'other',p:0,c:100,f:0,cal:387,img:'sugar.jpg'},
  {name:'Brown Sugar',cat:'other',p:0,c:98,f:0,cal:380,img:'brown-sugar.jpg'},
  {name:'Cocoa Powder (unsweetened)',cat:'other',p:20,c:58,f:14,cal:228,img:'cocoa-powder.jpg'},
];

const SNACKS_DIR = 'assets/foods/snacks/';
const SNACKS = [
  {name:'Dark Chocolate (70-85%)',cat:'other',p:7.8,c:46,f:43,cal:598,img:'dark-chocolate.jpg'},
  {name:'Milk Chocolate',cat:'other',p:7.7,c:59,f:30,cal:535,img:'milk-chocolate.jpg'},
];

const SUPPLEMENTS_DIR = 'assets/foods/supplements/';
const SUPPLEMENTS = [
  {name:'Whey Protein Powder (dry)',cat:'protein',p:80,c:8,f:4,cal:388,img:'whey-protein.jpg'},
];

// All drinks are per 100ml.
const DRINKS_DIR = 'assets/foods/drinks/';
const DRINKS = [
  {name:'Coffee (black, brewed)',cat:'other',unit:'ml',p:0.1,c:0,f:0,cal:1,img:'coffee.jpg'},
  {name:'Green Tea (brewed)',cat:'other',unit:'ml',p:0.2,c:0,f:0,cal:1,img:'green-tea.jpg'},
  {name:'Black Tea (brewed)',cat:'other',unit:'ml',p:0,c:0.3,f:0,cal:1,img:'black-tea.jpg'},
  {name:'Orange Juice (fresh)',cat:'carbs',unit:'ml',p:0.7,c:10,f:0.2,cal:45,img:'orange-juice.jpg'},
  {name:'Apple Juice (100%)',cat:'carbs',unit:'ml',p:0.1,c:11,f:0.1,cal:46,img:'apple-juice.jpg'},
  // Branded sodas — macros from each brand's published nutrition facts.
  {name:'Coca-Cola Classic',cat:'other',unit:'ml',p:0,c:10.6,f:0,cal:42,img:'coca-cola.jpg'},
  {name:'Coke Zero',cat:'other',unit:'ml',p:0,c:0,f:0,cal:0,img:'coke-zero.jpg'},
  {name:'Pepsi',cat:'other',unit:'ml',p:0,c:11,f:0,cal:43,img:'pepsi.jpg'},
  {name:'Sprite',cat:'other',unit:'ml',p:0,c:9,f:0,cal:38,img:'sprite.jpg'},
  {name:'Fanta Orange',cat:'other',unit:'ml',p:0,c:11.2,f:0,cal:44,img:'fanta.jpg'},
  {name:'Dr Pepper',cat:'other',unit:'ml',p:0,c:10.3,f:0,cal:41,img:'dr-pepper.jpg'},
  {name:'7UP',cat:'other',unit:'ml',p:0,c:10.5,f:0,cal:42,img:'7up.jpg'},
  {name:'Red Bull',cat:'other',unit:'ml',p:0.4,c:11,f:0,cal:46,img:'red-bull.jpg'},
  {name:'Gatorade',cat:'other',unit:'ml',p:0,c:6,f:0,cal:24,img:'gatorade.jpg'},
];

const withDir = (arr, dir) => arr.map(x => ({...x, img: dir + x.img}));

export const NL_INGREDIENTS = [
  ...withDir(MEAT, MEAT_DIR),
  ...withDir(SEAFOOD, SEAFOOD_DIR),
  ...withDir(DAIRY, DAIRY_DIR),
  ...withDir(GRAINS, GRAINS_DIR),
  ...withDir(FRUITS, FRUITS_DIR),
  ...withDir(VEGETABLES, VEGETABLES_DIR),
  ...withDir(LEGUMES, LEGUMES_DIR),
  ...withDir(NUTS_AND_SEEDS, NUTS_AND_SEEDS_DIR),
  ...withDir(OILS_AND_CONDIMENTS, OILS_AND_CONDIMENTS_DIR),
  ...withDir(SNACKS, SNACKS_DIR),
  ...withDir(SUPPLEMENTS, SUPPLEMENTS_DIR),
  ...withDir(DRINKS, DRINKS_DIR),
];
