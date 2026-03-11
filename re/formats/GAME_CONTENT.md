# Alex Palm Island -- Complete Game Content Analysis

Reverse-engineered from 53 SCX scene scripts. All data extracted programmatically
from decrypted game files.

---

## 1. Critical Path (Required Scene Sequence)

The game follows a spy story: Alex is sent to Palm Island to find a missing spy
named Walter. The critical path requires visiting specific scenes in order,
solving puzzles, and completing dialog quizzes to progress.

### Opening Sequence (Linear)

```
LOGO -> OPENING -> OPEN2 -> SPYMASTR -> OPEN3 -> OPEN4 -> AIRPORT
```

- **OPENING**: Cutscene. Phone rings, Alex walks to street. Flag 1900 tracks
  whether this is first play (1900==0 -> go to OPEN2) or replay (1900==1 -> skip
  to OPEN3).
- **OPEN2**: Alex walks through hallway to the Spy Master's office.
- **SPYMASTR**: Briefing -- Spy Master tells Alex to find Walter on Palm Island.
  Gives bag with passport and letter for Walter. Pure narration (11 text sections,
  no interactivity).
- **OPEN3**: Plane flight animation.
- **OPEN4**: Landing, credits (Programming, Graphics, Language, Hebrew, Production,
  Onda).
- Transition: `OPEN4 -> snAirport:110`

### Airport (First Major Scene)

**AIRPORT** -- Alex must:

1. **Talk to escalator guard** (dialog 2010): "I am looking for @" -- all 4
   answers accepted, routes to different handlers.
2. **Passport control** (dialog 2300): Guard asks "Why are you here?" -- saying
   "I'm a spy!" leads to **ARREST** (section 227 -> snArrest:501). Correct
   answers: "on holiday" or "on business" (set flag 1017 to distinguish later).
3. **Fill passport form** (text section 650/830): Educational reading exercise.
4. **Lost & Found** (dialogs 2100-2150): Multi-step -- describe your bag (is it
   big? small? what colour?). Branching dialog tree sets flags 1006/1007/1008 for
   bag colour. Must find correct bag (flag 1009) or get arrested (section 325 ->
   snArrest:504 if 1009==0).
5. **Try to leave** (section 410/430): Trying to leave without passport clearance
   -> flag 1012/1013 escalation -> third attempt = ARREST (section 430 ->
   snArrest:503).
6. **Get map**: After passport (flag 1011==1), map becomes available.

Key flags: 1001 (passport done), 1005 (describe bag), 1009 (correct bag),
1010 (penalty for wrong answers), 1011 (bag collected), 1017 (said "on holiday"
vs "on business").

### Town Exploration (Non-Linear)

After airport, Alex reaches **STRIPAIR** (street outside airport), which connects
to the town map. The street network is:

```
STRIPAIR <-> STRIP0 <-> [STAPART, STBUTCHE, STCHOCO]
                           |          |          |
                        STBURGER <-> STSUPER <-> STZOO
                           |          |
                        STHOTEL <-> STHOSP
```

Each "ST" scene is a street connecting to shops, the hotel, and the zoo.
Navigation is via the map (once found) or walking between adjacent streets.

### Hotel & Finding Walter

1. **STHOTEL**: Pick up hammer (flag 1815), get hit on head -> transition to
   **WARD** (hospital).
2. **LOBBY** (via STHOTEL->snLobby): Talk to old man (dialogs 2010-2030), get
   chocolate (flag 1903). Register at front desk -> get room key.
3. **LOBBYDSK**: Talk to receptionist. Need credit card (flag 1904) to check in.
   Credit card comes from Cindy at Burger Bar (see below). Mismatch in
   business/holiday answer -> ARREST (flag 1027==0, section 150 -> snArrest:502).
4. **CORRIDOR**: Talk to cleaning lady (6 quiz dialogs). Use Pin/Key to enter
   rooms. Room 302 requires flag 1076 (toggle red/green light).
5. **ROOM301**: Get glue from drawer (flag 1908).
6. **ROOM302**: Get drawer key (flag 1907).
7. **ROOM303**: Phone to make photographer appointment (dialogs 2010-2030, flags
   1107-1109). Enter safe code -> ARREST if wrong (section 121, flag 1311==0 ->
   snArrest:524).
8. **WALTROOM** (Walter's room, via Floor4): Talk to spider (3 quiz dialogs).
   Find safe.
9. **SAFE**: Use glue, then photo -> get ID card (flag 1920). Safe code from
   Walter's diary.

### Ward (Hospital) -- Finding Walter

1. **WARD**: Walter is injured. Talk to Walter (dialogs 2010-2060). Give him
   letter (use LetterIcon). Walter tells about code to safe, accident location.
   Get letter back from Walter (via Polly the parrot conversation).
2. Give peanuts to Walter (flag 1919->0), completing the ward visit.

### Clothes Shop -- Meeting Cindy

1. **CLOTHES**: Talk to Cindy (6 quiz dialogs). Help put price tags on clothes
   (flag 1155). She invites Alex to meet at Burger Bar (flag 1160). After
   completing task, flag 1156 enables follow-up dialog.

### Burger Bar -- Extended Puzzle Chain

1. **BURGER**: Complex scene with multiple NPCs. Order food (6 quiz dialogs about
   ordering: menu, food, drinks, prices). Buy burger (flag 1909) and drink.
   Ask 4 NPCs about Walter (dialogs 2400-2700). Meet Cindy, who gives credit
   card (flag 1904 via section 420). Massive scene with 13 dialog sections.

### Butcher -- Puzzle with Chicken

1. **BUTCHER**: Talk to butcher (dialogs 2070-2100). Talk to chicken (dialogs
   2020-2060) -- riddle chain. Buy beef (flag 1913) or hotdog (flag 1914).
   Wrong actions with chicken lead to ARREST (flags 1405/1406).

### Photo Shop & Milk

1. **PHOTO**: Ask photographer (dialogs 2010-2025). Get picture taken (flag 1551,
   costs 50 Palmettoes). Talk to dog Spot about Snow the cat (dialogs 2020-2060).
   Get milk from fridge (flag 1917).
2. Photo and glue are needed for the ID card in the safe.

### Zoo -- Lion, Monkey, Bear

1. **STZOO**: Buy zoo ticket with coupon (costs 50 Palmettoes, flag 1921). Talk to
   ticket seller (3 quiz dialogs). Talk to Grandma (2 quiz dialogs) about
   Grandma Rosy.
2. **ZOOFRONT**: Giraffe riddles (2 dialogs), elephant riddles (2 dialogs). Pure
   educational humor.
3. **ZOOBACK**: Give chocolate to monkey area (flag 1611). Enter caveman exhibit.
4. **LIONCAGE**: Get notebook (Walter's diary, flag 1915). Feed lion: burger (flag
   1909->0), hotdog (1914->0), beef (1913->0). All meat items consumed.
5. **MONKEY/BEAR/CAVEMAN**: Touching exhibits -> ARREST (section 110 -> snArrest:511).

### Supermarket -- Cash Register Puzzle

1. **SUPER**: Massive scene. Cashier quiz: read prices from shelves (5 price
   dialogs -- peas 93, chocolate 28, toilet paper 48, lollipop 3, eggs 103).
   Wrong total at register = **-275 Palmettoes** penalty. Trade egg for peanuts
   (flag 1919). Must go "under" shelf to reach items (animation).

### Chocolate Factory -- End Game

1. **STCHOCO**: Guard at factory gate. Must show ID card (use IdCardIcon) to enter.
   Saying "spy" -> ARREST. Wrong business/holiday mismatch -> ARREST.
2. **FACTORY**: Talk to 3 workers (7 quiz dialogs). Learn secret recipe:
   - Worker A: chocolate, sugar, mix (flag 1671)
   - Worker B: milk and peanuts, then mix (flag 1672)
   - Worker C: T.W.P. = Taste, Wrap, Pack (flag 1673)
   Talk to employer about Grandma Rosy.

### Final Sequence: LiftRoom -> Control -> Ending

1. **LIFTROOM**: Use hammer to break into lift (flag 1651). Elevator puzzle.
   Wrong choices -> DEATH (section 180 -> snDeath:520, hot chocolate bath) or
   ARREST (section 195 -> snArrest:520).
2. **CONTROL**: Talk to Bubble-Brain computer (5 quiz dialogs). Computer reveals
   plan. Get Brain icon (flag 1657). Use drawer key on control panel. Enter
   correct code -> **ENDING** (section 310 -> snEnding:110). Wrong code ->
   **DEATH** (section 320 -> snDeath:509, electric wires).
3. **ENDING**: Victory cutscene. Alex and Walter escape. Credits roll.

### Complete Critical Path Summary

```
Opening -> SpyMaster -> Airport -> StripAir -> [explore town] ->
  StHotel (hammer) -> Ward (meet Walter) ->
  Clothes (meet Cindy) -> Burger (get credit card) ->
  LobbyDsk (check in with credit card) -> Room303 (phone photographer) ->
  Photo (get picture, get milk) -> Room301 (get glue) ->
  Room302 (get drawer key) ->
  Safe (make ID card: glue + photo) ->
  LionCage (get notebook/diary) ->
  Butcher (get meat) -> LionCage (feed lion) ->
  Super (trade egg for peanuts) ->
  Ward (give peanuts to Walter, give letter) ->
  StChoco (show ID) -> Factory (learn recipe) ->
  LiftRoom (use hammer) -> Control (use drawer key, enter code) ->
  Ending
```

---

## 2. Puzzle Dependency Graph

### Flag Dependencies (What Gates What)

```
FLAG     SET BY              REQUIRED FOR
------   ------------------  ------------------------------------------
1001     Airport:316-318     Airport:310 (passport done -> bag claim)
1009     Airport:323         Airport:325 (correct bag -> avoid arrest)
1017     Airport:226         Floor1:190 (dialog branch), StChoco:122-123
1042     LobbyDsk:127resp    StHotel:130 (hotel door)
1043     Lobby/StHotel       Lobby:310/400 (rear wall / credit card)
1107     Room303:2030 resp   StZoo:120 (photo shop accessible)
1151     Clothes:180         Clothes:120 (price tag done -> next dialog)
1160     Clothes:2080 resp   Burger:300 (Cindy at Burger, flag 1160)
1311     (diary code)        Room303:121 (safe code check)
1315     Aptment:110         Aptment:130 (first visit vs return)
1401     Butcher:161         Butcher:130/160 (bought meat)
1405/06  Butcher:2050 resp   Butcher:140 (chicken escape -> ARREST)
1407     Butcher:2060 resp   Butcher:135/140 (magic words known)
1456     Super:2070 resp     Super:310 (cashier done, can trade egg)
1477     Super:2020 resp     Super:230 (cashier asks for help)
1501     Ward:202            Ward:166/180 (peanut given)
1551     Photo:170           Room303:121 (have photo for safe)
1605     LionCage:240        LionCage:130 (fed burger to lion)
1606     LionCage:250-260    LionCage progression
1651     LiftRoom:140        Control:110, Factory:240/250
1653     Control:2060 resp   Control:130 (brain told how to help)
1654     LiftRoom:155        LiftRoom:170 (elevator activated)
1656     Control:200         Control:130 (brain removed)
1657     Control:210         Control:130/305 (have brain icon)
1800     StButche:260        StButche:260 (map found, one-time)
1807     StChoco:2010 resp   StChoco:135 (guard passed, can show ID)
1824     StripAir:2010 resp  StripAir:180 (info booth visited)
1901     Lobby:110           Lobby:140 (have zoo coupon)
1902     Lobby:120           LobbyDsk:121 (have coupon)
1903     Lobby:235           Lobby:240, ZooBack:230 (have chocolate)
1904     Burger:420          LobbyDsk:110-120 (have credit card)
1905     LobbyDsk:150        LobbyDsk:121 (have key 303)
1906     Corridor:110        (have pin icon)
1907     Room302:140         Control:300 (have drawer key)
1908     Room301:125         Room301:120 (have glue)
1909     Burger:130          LionCage:240 (have burger)
1911     Butcher:165         Super:300 (have egg)
1912     Aptment:120         Multiple (have envelope -> identifies Alex)
1913     Butcher:125         LionCage:260 (have beef)
1914     Butcher:126         LionCage:250 (have hotdog)
1915     LionCage:130        (have notebook/diary)
1917     Photo:145           Photo:200 (have milk)
1918     Ward:174 / Gbl:10004  Ward:165 (letter for Walter)
1919     Super:310           Ward:201 (have peanuts)
1920     Safe:115            StChoco:130 (have ID card)
1921     StZoo:185           StZoo:151 (have zoo ticket)
```

### Item Flow (Acquire -> Use -> Consume)

```
ITEM             ACQUIRED AT         USED AT              CONSUMED?
-----------      ---------------     ------------------   ---------
PassportIcon     (start)             Airport:221          No
LetterIcon       (start)             Ward:165             Returned
EnvelopeIcon     Aptment:120         (identification)     No
HammerIcon       StHotel:120         LiftRoom:120         No
ChocolateIcon    Lobby:235           ZooBack:230          Yes
ZooCouponIcon    Lobby:110           StZoo:180            Yes
CouponIcon       Lobby:120/Burger    Burger:160           No
CreditIcon       Burger:420/Lobby    LobbyDsk:140         No
Key303Icon       LobbyDsk:150        Corridor:145         No
PinIcon          Corridor:110        Corridor:120/130     No
DrawerKeyIcon    Room302:140         Control:300/305      No
GlueIcon         Room301:125        Safe:120              Yes
PhotoIcon        Photo:180           Safe:120              Yes
MilkIcon         Photo:145           Photo:200             Yes
BurgerIcon       Burger:130          LionCage:230          Yes
DrinkIcon        Burger:153/170      Burger:320/350        No
HotdogIcon       Butcher:126         LionCage:250          Yes
BeefIcon         Butcher:125         LionCage:260          Yes
EggIcon          Butcher:165         Super:300              Yes (->Peanut)
PeanutIcon       Super:310           Ward:201               Yes
NotebookIcon     LionCage:130        (diary - safe code)    No
IdCardIcon       Safe:115            StChoco:130            No
BrainIcon        Control:210         (trophy)               No
ZooTicketIcon    StZoo:185           (zoo entry)            No
```

---

## 3. All Educational Activities by Scene

### Grammar Quiz Dialogs (113 reward-bearing, 114 quiz-style total)

Every quiz has the same format: NPC speaks, Alex must construct a correct English
sentence by choosing words to fill @ blanks. One answer is correct (advances),
others are wrong (2,0,0,Silence -- no transition, must retry).

There are **114** quiz-style dialog sections in the decrypted SCX files, but only
**113** are reward-bearing grammar quizzes. The one excluded case is
`STCHOCO` section `2060,0,ALTalk` ("How much is the bubble gum?"), which is a
price question that leads into an explicit `P,-10` purchase flow rather than a
Palmettoes reward.

**AIRPORT (0 grammar quizzes, 7 choice dialogs)**
- Dialog 2010: "I am looking for @" (hotel/bag/food/taxi) -- all correct, routing
- Dialogs 2100-2150: Describe bag (big/small? colour?) -- all correct, routing
- Dialog 2300: "Why are you here?" -- "I'm a spy!" is a trap -> arrest
- Dialog 2310: Same as 2010 but with female guard

**STRIPAIR (3 quizzes: flags 1840-1842)**
- Cat Snow dialog chain (the known +10 Palmettoes each):
  - "I @ Alex!" -> **am** (not be/is)
  - "What are you looking @ in the rubbish bin?" -> **for** (not after/up)
  - "Don't they feed you @ home?" -> **at** (not in/on)

**BURGER (12 quizzes: flags 1221-1228, 1233-1236)**
- Ordering food chain (6 quizzes):
  - "Can I see a menu, please?" (@ @ @ @ = "Can I see a")
  - "What do you have to eat?" (@ @ @ @ = "what do you have")
  - "Give me one Big Bob Burger, please" (choice, no @)
  - "What do you have to drink?" (@ @ @ @ = "what do you have")
  - "How much does it cost?" (@ @ @ @ = "how much does it")
  - "Is it free?" (@ @ @ = "is it free")
- Cindy dialog (3 quizzes):
  - "What do you want?" (@ @ @ @ = "what do you want")
  - "What did I do wrong?" (@ @ @ @ = "what did I do")
  - "What do you want?" (repeat for second encounter)
- Walter search (4 quizzes):
  - "Do you know Walter?" x4 with different NPCs (girl, boy, bag man, eater)

**BUTCHER (6 quizzes: flags 1409-1411, 1415-1417)**
- Chicken riddle chain:
  - "How should I know?" (@ @ @ @ = "how should I know")
  - "How can I help you?" (@ @ @ @ = "how can I help")
  - "What are the magic words?" (@ @ @ @ = "what are the magic")
- Meat purchasing:
  - "What kind of meat do you have?" (@ @ @ @ = "kind of meat do")
  - "How much do the hotdogs cost?" (@ = "do" + @ = "cost")
  - "How much does the beef cost?" (@ = "does" + @ = "costs")

**CLOTHES (6 quizzes: flags 1152-1153, 1155, 1157-1159)**
- Meeting Cindy:
  - "I'm just looking" (@ @ @ = "I'm just looking")
  - "Can I help you?" (@ @ @ @ = "can I help you")
  - "At your service!" (@ @ @ = "at your service")
  - "Yes, I know" (@, @ @ = "yes I know")
  - "Tell me when and where" (@ @ @ = "tell me when")
  - "I'll see you there" (@ @ @ @ = "I'll see you there")

**CORRIDOR (6 quizzes: flags 1061-1065, 1077)**
- Cleaning lady chain:
  - "Do you know Walter?" (@ @ @ @ = "Do you know Walter")
  - "Are you friends?" (@ @ @ = "are you friends")
  - "Is he staying at the hotel?" (@ @ @ @ = "is he staying at")
  - "Will you see him soon?" (@ @ @ @ = "will you see him")
  - "Did anything happen to him?" (@ @ @ @ = "did anything happen to")
  - "Can you find out?" (@ @ @ @ = "can you find out")

**CONTROL (5 quizzes: flags 1665-1669)**
- Bubble-Brain computer:
  - "I thought I was the Bubble-Brain!" (@ = "thought")
  - "Why should I?" (@ = "should")
  - "Why not?" (choice)
  - "So what?" (@ = "what")
  - "How?" (@ = "How")

**FACTORY (7 quizzes: flags 1658-1664)**
- Worker A: "Excuse me, sir" (@ = "Excuse me")
- Worker A: recipe order (choice: "chocolate... sugar... mix...")
- Worker B: "What is all this nonsense?" (@ = "is")
- Worker B: ingredient order (choice: "milk and peanuts")
- Worker C: "What kind of code?" (@ = "What")
- Worker C: "What does it mean?" (@ = "does it mean")
- Worker C: T.W.P. decode (choice: "taste... wrap... pack!")

**FLOOR1 (3 quizzes: flags 1318-1320)**
- Fish character:
  - "What are you talking about?" (@ = "are you talking")
  - "How do they know?" (@ = "do they know") -- two variants based on flag 1017

**FLOOR4 (2 quizzes: flags 1316-1317)**
- Gorilla:
  - "What are you talking about?" (@ = "are you talking")
  - "What about me?" (@ = "me" -- not I/my/mine -- object pronouns)

**LOBBY (1 quiz: flag 1026)**
- Old man: "I don't eat chocolate" (@ = "don't eat" -- negation)

**LOBBYDSK (2 quizzes: flags 1047-1048)**
- Receptionist:
  - "SPECIAL PRICES FOR CREDIT CARDS" (@ @ @ @ reading comprehension)
  - "I want a room" (@ @ @ @ = "I want a room")

**PHOTO (7 quizzes: flags 1559-1565)**
- Photographer: "Do you take pictures?" (@ = "do" + @ = "take")
- Photographer: "Take my picture!" (@ = "Take" -- imperative)
- Dog Spot chain (5 quizzes): who/what/where/how questions about Snow the cat
  - "What does who do?" / "What does she look like?" / "Where can who be?"
  - "How should I know?" / "Maybe she will be here soon"

**ROOM303 (2 quizzes: flags 1108-1109)**
- Phone to photographer:
  - "I want to make an appointment" (@ @ @ @ = "I want to make")
  - "I'm on my way!" (@ @ @ @ = "I'm on my way")

**STAPART (4 quizzes: flags 1817, 1831-1833)**
- Electrician: "I only want to ask you a question" (@ = "a" -- articles)
- Mailman chain:
  - "For what?" (@ = "for what")
  - "Hurry up!" (@ = "up" -- phrasal verbs)
  - "Why not?" (@ = "not")

**STBURGER (7 quizzes: flags 1825-1827, 1829-1830, 1834)**
- Policeman: directions (all correct, routing)
- Policeman: "That's what you said before!" (@ = "said" -- past tense)
- Taxi driver chain (3 quizzes): "Why/What/Tell" -- question words
- Jailbird chain (3 quizzes): "Why should I?" / "Who says?" / "Tell me"

**STBUTCHE (3 quizzes: flags 1842-1844)**
- Cleaning lady (again!): politeness chain
  - "Excuse me, do you have the time?" (@ = "Excuse me")
  - "I'm sorry about that..." (@ = "I'm sorry")
  - "What time is it?" (@ = "What time is it")

**STCHOCO (5 quizzes: flags 1819-1822 + 2 non-flagged)**
- Guard: "Why are you here?" (spy trap -- same as airport)
- Children chain: "What did he take?" / "Why don't you share?" / "Tell me"
  / "Nice to meet you" (meet vs meat homophone)
- Bubble gum vendor: "How much?" / "Yes please/No thank you"

**STHOSP (1 quiz: flag 1828)**
- Vampire: "I can't find Walter" (@ = "find" -- verb form)

**STHOTEL (3 quizzes: flags 1837-1839)**
- Newspaper seller:
  - "Can I have a newspaper?" (@ = "can")
  - "So what are these?" (@ = "these" -- demonstratives)
  - "I hope it doesn't rain" (@ = "doesn't" -- negation)

**STSUPER (4 quizzes: flags 1809-1811, 1823)**
- Doughnut seller:
  - "Fine thank you, and you?" (choice -- greetings)
  - "Can I have a doughnut?" (@ = "a" -- articles)
  - "I am looking for Rudolf" (@ = "for" -- prepositions)
  - "Rudolf eats doughnuts!" (@ = "eats" -- third person -s)

**STZOO (5 quizzes: flags 1803-1806, 1835-1836)**
- Ticket seller chain:
  - "What animals are there?" (@ = "there" -- there/their/they're)
  - "Can I have a ticket?" (@ = "can")
  - "How much does a ticket cost?" (@ = "how much")
- Grandma chain:
  - "I'm sorry, Grandma" (choice -- apologies)
  - "Are you Grandma Rosy?" (@ = "are you")
  - "Nice to meet you" (meet vs meat again)

**SUPER (6 quizzes: flags 1451, 1480-1484)**
- Cashier: "What do you want me to do?" (@ @ @ @ = "you want me to")
- Price reading (5 quizzes): identify correct prices
  - Peas: 93 / Chocolate: 28 / Toilet paper: 48 / Lollipop: 3 / Eggs: 103

**WALTROOM (3 quizzes: flags 1304-1306)**
- Spider: "Who are you?" / "What are you doing here?" / "What are you eating?"

**WARD (6 quizzes: flags 1504-1509)**
- Walter: "What's the matter?" (@ @ @ = "what's the matter")
- Polly the parrot: "prettier than" (@ = "prettier than" -- comparatives)
- Polly: "more than" (@ = "more than" -- comparatives)
- Walter: "So you're Walter!" (@ = "you're" -- contractions)
- Walter: "What's going on?" (@ = "going" -- present participle)
- Walter: "Where was the accident?" (@ = "was" -- past tense be)

**ZOOFRONT (4 quizzes: flags 1612-1617)**
- Giraffe jokes: "stiff neck" / "a long way" (vocabulary)
- Elephant jokes: "new fence" / "chicken's day off" (vocabulary/prepositions)

### Non-Quiz Educational Content

**Airport Form (section 650, type 4 zoom)**
- Visual reading exercise: passport/customs form fill-out. The form display
  (text section 830: "What is your name?") teaches form comprehension.

**Signs & Reading Comprehension (throughout)**
- Airport: "Please wait your turn" (570), "Exit" (670), "Special Prices!" (810)
- Clothes: "Sorry! No sales today!" (800), shop window price tags
- LobbyDsk: "SPECIAL PRICES FOR CREDIT CARDS" (quiz 2020: rearrange words)
- StChoco: Electric fence warning sign
- Various "Read the sign!" death/arrest messages

**Supermarket Price Reading**
- 19 product close-ups (zoom sections) where player reads price tags
- Products include: peas, chocolate, toilet paper, lollipop, eggs, etc.
- Then tested via cashier quiz

**Vocabulary Through Narration (847 text sections)**
- Every object has a "look" description teaching vocabulary in context
- Rich descriptive English for everyday objects (counter, escalator, hanger, rail)

**Preposition/Phrasal Verb Focus**
- "looking for" (StripAir, StSuper, Photo)
- "at home" vs "in home" (StripAir)
- "hurry up" (StApart)
- "looking after/for/up" (StripAir)

**Comparative/Superlative (Ward)**
- "prettier than" and "more than" with Polly the parrot

**Homophones (StChoco, StZoo)**
- "meet" vs "meat" appears twice as a quiz option

---

## 4. SPYMASTR.SCX Analysis

**Triggered by**: OPEN2 section 100 (`C,snSpyMaster,0`) -- always reached on
first playthrough. Part of the mandatory opening sequence.

**Content**: 11 text reference sections (501-511) + 1 animation section (5010).
Pure narration, no interactivity.

**Briefing text (in order):**
1. "Good morning, Alex."
2. "We have a spy named Walter."
3. "He went to Palm Island but now we don't know where he is."
4. "Go to Palm Island. Find Walter before it's too late."
5. "Go everywhere. Look at everything. Talk to everyone."
6. "Take things from the places you visit. You never know what may come in handy."
7. "Here is your bag. Don't lose it! Your passport is inside."
8. "There is also a letter to Walter inside the bag."
9. "When you find him, give it to him."
10. "Palm Island is a very strange place. Anything can happen there, so be careful!"
11. "Remember! I am watching!"

The animation section (5010) is minimal: `G -1,0` then `Q` -- likely a simple
camera move or character gesture.

**Purpose**: Establishes the entire game premise and teaches the player the
five core mechanics (go, look, talk, take, give).

---

## 5. All Arrest Triggers (-> PRISON)

Every arrest goes through ARREST.SCX (plays police animation) then transitions to
PRISON.SCX which displays the reason and restarts.

| Source Scene | Section | Arrest Code | Reason |
|-------------|---------|-------------|--------|
| Airport | 227 | 501 | Told passport officer "I'm a spy!" |
| Airport | 325 | 504 | Took wrong bag (flag 1009==0) |
| Airport | 430 | 503 | Tried to leave 3 times without clearance |
| Bear | 110 | 511 | Touched exhibit (read the signs!) |
| Butcher | 140 | 509 | Chicken escape -- said "I'll get into deep trouble" |
| Butcher | 140 | 510 | Chicken escape -- said "Why should I?" |
| Caveman | 110 | 511 | Touched exhibit |
| Control | 115 | 521 | Guard caught you (no hammer/lift) |
| Control | 160 | 522 | Pressed wrong buttons without code |
| Factory | 240 | 523 | Took things from factory (enough is enough) |
| Factory | 250 | 511 | Touched exhibit/sign |
| LiftRoom | 195 | 520 | Went back up after going down |
| LiftRoom | 200 | 511 | Touched sign |
| LionCage | 270 | 511 | Touched sign |
| LobbyDsk | 150 | 502 | Business/holiday mismatch (flag 1027==0) |
| Monkey | 110 | 511 | Touched monkey exhibit |
| Room302 | 200 | 505 | Entered someone else's room |
| Room303 | 121 | 524 | Knew safe code without diary (cheating!) |
| StButche | 115,125 | 511 | Touched statue (2 locations) |
| StChoco | 121 | 512 | Told guard "I'm a spy!" (at factory) |
| StChoco | 122,123 | 502 | Business/holiday mismatch at factory gate |
| Ward | 125 | 507 | "Did you think killing him was a good idea?" |
| Ward | 166 | 508 | Polly the parrot snitched on you |
| ZooBack | 110 | 511 | Touched exhibit |
| ZooFront | 110 | 511 | Touched exhibit |

**Prison messages** (text sections in PRISON.SCX):

| Code | Message |
|------|---------|
| 500 | You do not have any money left! |
| 501 | It isn't clever to tell people that you are a spy! |
| 502 | Make up your mind! Are you here on business or on holiday? |
| 503 | That guard was serious when she told you not to leave! |
| 504 | Next time, make sure you take the right bag! |
| 505 | You should be more careful when you enter someone else's room. |
| 506 | You were lucky once, but never push your luck! |
| 507 | Did you think that killing him was a good idea? |
| 508 | That parrot has the biggest mouth in town. |
| 509 | Just like you thought, you're in deep trouble now. |
| 510 | Sometimes, good guys finish last. |
| 511 | Next time, make sure to read the signs. |
| 512 | It isn't clever to tell a guard that you are a spy! |
| 520 | It was not a good idea to go back up there. |
| 521 | That guard was waiting for people like you! |
| 522 | Before you press the buttons, find the right order! |
| 523 | Enough is enough. You can't keep taking things that are not yours. |
| 524 | You cheat! Did a friend give you that telephone number? |
| 525 | You cheat! Did a friend give you the code to the safe? |
| 526 | You cheat! Did a friend give you the code? |

---

## 6. All Death Triggers

Deaths go through DEATH.SCX which plays a funeral/cemetery scene, displays the
reason, then restarts.

| Source Scene | Section | Death Code | Reason |
|-------------|---------|------------|--------|
| Aptment | 135 | 504 | Fell in the dark! (first visit, flag 1315==0) |
| Floor1 | 110 | 505 | Stranger attacked ("That guy really likes strangers") |
| Floor2 | 140 | 506 | Poisonous plant |
| LiftRoom | 180 | 520 | Hot chocolate bath (lift broken) |
| LionCage | 160 | 502 | Eaten by hungry lion |
| Lobby | 310 | 501 | Broken lift (flag 1043 not set) |
| StChoco | 110 | 507 | Electric fence (didn't read the sign) |
| StHosp | 160 | 508 | Hit by traffic (didn't see traffic light) |
| ZooBack | 270 | 502 | Lion attack (same message as LionCage) |
| Control | 320 | 509 | Electric wires (wrong code at control panel) |

**Death messages** (text sections in DEATH.SCX):

| Code | Message |
|------|---------|
| 501 | The lift is broken! Didn't you read the sign? |
| 502 | The hungry lion thought that you looked really tasty! |
| 503 | The sign told you to be careful when using electricity. Didn't you read it? |
| 504 | You fell in the dark! |
| 505 | That guy really likes strangers, doesn't he? |
| 506 | That plant was poisonous. |
| 507 | Didn't you read the sign? That was an electric fence! |
| 508 | Didn't you see the traffic light? |
| 509 | Those were electric wires! |
| 520 | Hot chocolate is good to drink. It isn't good for a bath! |

---

## 7. Palmettoes Budget Analysis

### Starting Balance
**100 Palmettoes** (established at game start).

### All Penalties (P commands in SCX)

| Scene | Amount | Context | Avoidable? |
|-------|--------|---------|------------|
| Airport | -15 | Wrong answer to passport officer | Yes |
| Airport | -10 | Lost baggage mistake | Yes |
| Burger | -50 | Buying the burger (section 130) | Required item |
| Burger | -10 | Using the jukebox (section 210) | Yes |
| Butcher | -15 | Buying beef (section 125) | Required item |
| Butcher | -10 | Buying hotdog (section 126) | Required item |
| Butcher | -10 | Buying egg (section 161) | Required item |
| LobbyDsk | -40 | Checking in (section 150) | Required action |
| Photo | -50 | Getting picture taken (section 170) | Required |
| StChoco | -10 | Buying bubble gum (section 250) | Yes |
| StHosp | -5 | Drinking OJ at hospital (section 140) | Yes |
| StSuper | -10 | Getting doughnut (section 111) | Yes |
| StZoo | -50 | Buying zoo ticket (section 185) | Required |
| Super | -275 | Wrong total at cash register (section 290) | Yes |
| **Total** | **-560** | | |

### Known Rewards

The dialog system awards Palmettoes for correctly completing grammar quizzes.
The cat dialog in StripAir is known to give **+10** per correct answer (3
answers = +30).

**All 113 quiz dialogs** follow the same completion pattern. If the engine awards
+10 per completed quiz dialog:
- Maximum possible rewards: 113 x 10 = **+1,130 Palmettoes**
- But many quizzes are optional (only ~40-50 are on the critical path)

### Required Costs (Unavoidable on Critical Path)

| Cost | Source |
|------|--------|
| -50 | Burger: buy burger |
| -15 | Butcher: beef |
| -10 | Butcher: hotdog |
| -10 | Butcher: egg |
| -40 | LobbyDsk: check in |
| -50 | Photo: picture |
| -50 | StZoo: zoo ticket |
| **-225** | **Minimum required** |

### Budget Calculation

```
Starting balance:           100
Required costs:            -225
Deficit:                   -125

Minimum quizzes needed:     13 (if +10 each) to cover deficit
Available quizzes on path:  ~50
```

**Can you complete the game without running out?** Yes, comfortably. The required
spending is 225, leaving a deficit of 125 from the starting 100. Completing just
13 grammar quizzes on the critical path (out of ~50 available) covers this
deficit. A player who completes most quizzes will have a large surplus.

**Can you go bankrupt?** Yes. The -275 supermarket penalty is the biggest danger.
If triggered on top of required costs: 100 - 225 - 275 = -400, which would
require 40+ quizzes to recover from. Running out of money triggers Prison code
500: "You do not have any money left!"

**Optimal play**: Complete all quizzes before spending. Avoid the supermarket
wrong answer (-275), bubble gum (-10), doughnut (-10), hospital OJ (-5), and
airport mistakes (-25). This yields: 100 + ~500 (critical path quizzes) - 225
(required) = ~375 Palmettoes at endgame.

---

## 8. English Grammar Topics Covered

The game systematically teaches these English grammar topics:

1. **Question formation**: Who/What/Where/When/Why/How + aux verb inversion
2. **Verb forms**: present simple, past simple, present continuous, modals
3. **Articles**: a/an/the/some
4. **Pronouns**: I/me/my/mine, you/your/yours/you're
5. **Negation**: don't/doesn't/can't/isn't
6. **Comparatives/Superlatives**: prettier than, more than (Ward)
7. **Prepositions**: at/in/on/for/after/up (phrasal verbs)
8. **Homophones**: meet/meat, there/their/they're
9. **Politeness formulas**: Excuse me/I'm sorry/Thank you/You're welcome
10. **Greetings**: How do you do?/Fine thank you/Nice to meet you
11. **Word order**: scrambled sentences (4-word puzzles)
12. **Reading comprehension**: signs, forms, price tags
13. **Vocabulary**: everyday objects, animals, food, shops
14. **Numbers/Prices**: reading and identifying prices (Super)

---

## 9. Scene Census

| Category | Scenes | Count |
|----------|--------|-------|
| Opening | LOGO, OPENING, OPEN2, OPEN3, OPEN4, SPYMASTR | 6 |
| Airport | AIRPORT | 1 |
| Streets | STRIP0, STRIPAIR, STAPART, STBURGER, STBUTCHE, STCHOCO, STHOSP, STHOTEL, STSUPER, STZOO | 10 |
| Shops | BURGER, BUTCHER, CLOTHES, PHOTO, SUPER | 5 |
| Hotel | LOBBY, LOBBYDSK, CORRIDOR, ROOM301, ROOM302, ROOM303, WALTROOM, SAFE | 8 |
| Apt/Floors | APTMENT, FLOOR1, FLOOR2, FLOOR3, FLOOR4 | 5 |
| Hospital | WARD, STHOSP (street) | 1 (+street) |
| Zoo | ZOOFRONT, ZOOBACK, LIONCAGE, MONKEY, BEAR, CAVEMAN | 6 |
| Factory | FACTORY, LIFTROOM, CONTROL | 3 |
| Endings | ENDING, ARREST, DEATH, PRISON | 4 |
| System | GLOBAL, INVENT, DEMO | 3 |
| **Total** | | **53** |
