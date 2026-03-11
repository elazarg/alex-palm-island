# Flag & Inventory Reference

Complete reference for all 194 game flags and 24 inventory items, extracted
from 53 SCX scene scripts. Flags are stored in the 1252-byte bit array
(offsets 0x000–0x4E3) of `.GAM` save files.

## Flag Sources

Flags are set by two mechanisms:
- **SCX `F` command**: `0,0,F,flag_id,value` in interactive sections (112 flags)
- **Engine dialog system**: Automatically set when a quiz/dialog is answered
  correctly. The `completion_flag` field in dialog section headers specifies
  which flag to set. (65 flags are engine-set only)

Flags 1 and 2 are special: they store the **most recent quiz answer result**
(correct/incorrect) used by the engine to determine rewards. They are checked
190+ times across all scenes.

## Item Lifecycle

Each inventory item has a slot ID (501–524), an acquisition flag (set by the
engine when the `G` command gives the item), and defined obtain/consume locations.

| Slot | Item | Obtained at | Flag | Consumed at | Notes |
|------|------|-------------|------|-------------|-------|
| 501 | Passport | (start) | - | - | Given by Spy Master in opening |
| 502 | Letter | (start) | 1918 | WARD:202, GLOBAL | Letter for Walter; consumed when delivered |
| 503 | Coupon | LOBBY:120 | 1902 | BURGER:170 | Discount coupon from hotel lobby |
| 504 | ZooCoupon | LOBBY:110 | 1901 | STZOO:185 | Zoo discount from hotel lobby |
| 505 | Chocolate | LOBBY:235 | 1903 | ZOOBACK:240 | Given by Terri; feed to monkey |
| 506 | Credit | BURGER:420 or LOBBY:400 | 1904 | - | Credit card; two obtain paths (LOBBY requires flag 1043) |
| 507 | Key303 | LOBBYDSK:150 | 1905 | - | Room 303 key from front desk |
| 508 | Pin | CORRIDOR:110 | 1906 | - | Safety pin; requires flag 1075 (pin visible) |
| 509 | DrawerKey | ROOM302:140 | 1907 | - | Key to Room 301 drawer |
| 510 | Glue | ROOM301:125 | 1908 | SAFE:130 | From drawer; used on safe fingerprint |
| 511 | Burger | BURGER:130 | 1909 | BURGER:330, LIONCAGE:240 | Costs 50P; feed to lion |
| 512 | Drink | BURGER:170 | 1910 | BURGER:153, BURGER:340 | From Burger Bar |
| 513 | Egg | BUTCHER:165 | 1911 | SUPER:310 | From butcher; used at supermarket |
| 514 | Envelope | APTMENT:120 | 1912 | - | From Walter's apartment |
| 515 | Beef | BUTCHER:125 | 1913 | LIONCAGE:260 | Costs 15P; feed to lion |
| 516 | Hotdog | BUTCHER:126 | 1914 | LIONCAGE:250 | Costs 10P; feed to lion |
| 517 | Notebook | LIONCAGE:130 | 1915 | - | Walter's diary from lion cage |
| 518 | Photo | PHOTO:180 | 1916 | SAFE:140 | ID photo from Phil; used on safe |
| 519 | Milk | PHOTO:145 | 1917 | PHOTO:201 | From Phil's fridge; consumed in scene |
| 520 | Peanut | SUPER:310 | 1919 | WARD:202 | From supermarket; give to Walter |
| 521 | IDCard | SAFE:115 | 1920 | - | Fake ID from safe (glue + photo) |
| 522 | ZooTicket | STZOO:185 | 1921 | - | Costs 50P; zoo admission |
| 523 | Hammer | STHOTEL:120 | 1922 | LIFTROOM:140 | From hotel street; use on lift machine |
| 524 | Brain | CONTROL:210 | 1657 | - | Final objective; from factory control room |

## Complete Flag Dictionary

### Special Flags (engine-internal)

| Flag | Checked | Meaning |
|------|---------|---------|
| 1 | 190x | Quiz answer result — engine sets to 1 on correct answer |
| 2 | 114x | Quiz answer result — secondary (used by some dialog trees) |
| 177 | 1x | Safe code: digit answer (WaltRoom puzzle) |
| 228 | 1x | Safe code: digit answer |
| 230 | 1x | Safe code: digit answer |
| 245 | 1x | Safe code: digit answer |
| 308 | 1x | Safe code: digit answer |

### Airport (flags 1001–1017)

| Flag | Set by | Checked | Meaning |
|------|--------|---------|---------|
| 1001 | AIRPORT:316/317/318 | 1x | Bag description started |
| 1002 | AIRPORT:316 | 3x | Bag described as green |
| 1003 | AIRPORT:318 | 3x | Bag described as pink |
| 1004 | AIRPORT:317 | 4x | Bag described as black (correct answer → flag 1009) |
| 1005 | AIRPORT:321/322/323 | 3x | Bag size/color described |
| 1006 | engine | 3x | Dialog: bag is green |
| 1007 | engine | 3x | Dialog: bag is large |
| 1008 | engine | 3x | Dialog: bag is pink |
| 1009 | AIRPORT:323 | 7x | Correct bag identified (gates bag retrieval) |
| 1010 | AIRPORT:229 | 4x | Passport obtained (paid 15 Palmettoes) |
| 1011 | AIRPORT:325=0, 440=1 | 3x | Bag retrieved from lost-and-found |
| 1012 | AIRPORT:430 | 3x | Passport: second attempt |
| 1013 | AIRPORT:430 | 3x | Passport: third attempt (arrest on fail) |
| 1015 | AIRPORT:310 | 3x | Passport officer interaction complete |
| 1016 | AIRPORT:310 | 2x | Map hint given by officer |
| 1017 | AIRPORT:226 | 10x | Said "on holiday" (checked by StChoco guard, Floor1 NPCs) |

### Hotel (flags 1021–1076)

| Flag | Set by | Checked | Meaning |
|------|--------|---------|---------|
| 1021 | engine | 4x | Terri (bellboy) greeted player |
| 1023 | CORRIDOR:155, LOBBY:100 | 1x | Returning from hotel room to corridor |
| 1024 | LOBBY:235 | 1x | Terri gave chocolate |
| 1025 | LOBBY:221 | 2x | Talked to tourist lady in lobby |
| 1027 | engine | 3x | Front desk: holiday/business answer (consistency check) |
| 1041 | LOBBY:320/400, LOBBYDSK:150, STHOTEL:130 | 5x | Room assignment state machine |
| 1042 | engine | 5x | Terri dialog quiz complete |
| 1043 | LOBBY:400, STHOTEL:130 | 4x | Terri credit card scene done |
| 1044 | LOBBY:320/400, LOBBYDSK:150 | 1x | Checked in at front desk |
| 1045 | LOBBYDSK:150 | 1x | Room key obtained |
| 1049 | engine | 4x | Front desk receptionist quiz answer |
| 1050 | engine | 3x | Front desk quiz complete |
| 1051 | CORRIDOR:410, LOBBY:320 | 1x | Room accessible from corridor |
| 1052 | CORRIDOR:420, ROOM301:135 | 1x | Room 301 visited |
| 1053 | CORRIDOR:430, ROOM302:135 | 1x | Room 302 visited |
| 1054 | CORRIDOR:440, ROOM303:490 | 1x | Room 303 visited |
| 1055 | CORRIDOR:146 | 1x | Corridor: first door interaction |
| 1056 | CORRIDOR:176 | 2x | Corridor: second door interaction |
| 1066–1070 | engine | 1x each | Room quiz answers (5 flags) |
| 1075 | CORRIDOR:110 | 2x | Safety pin visible on floor |
| 1076 | CORRIDOR:200 | 12x | Room 302 door: red/green light toggle (-1 = toggle) |

### Room 303 / Safe (flags 1100–1142)

| Flag | Set by | Checked | Meaning |
|------|--------|---------|---------|
| 1100 | ROOM303:110/115 | 3x | Phone state (0=off, 1=on) |
| 1101 | ROOM303:110/115 | 1x | Photographer call progress |
| 1102 | ROOM303:115 | 4x | Safe lock state (toggleable) |
| 1103–1105 | ROOM303:120 | 1x each | Safe code digits entered |
| 1106 | ROOM303:140 | 0x | Safe combination entry (set but never checked by SCX) |
| 1107 | engine | 2x | Photographer appointment made (dialog) |
| 1120 | CORRIDOR:135 | 0x | Room 302 lockpick state |
| 1121 | ROOM302:110 | 2x | Room 302 internal state 1 |
| 1123 | ROOM302:150 | 4x | Room 302 internal state 2 |
| 1140 | CORRIDOR:125 | 0x | Room 301 lockpick state |
| 1141 | ROOM301:110 | 4x | Room 301 drawer state 1 |
| 1142 | ROOM301:150 | 4x | Room 301 drawer state 2 |

### Clothes Shop (flags 1151–1160)

| Flag | Set by | Checked | Meaning |
|------|--------|---------|---------|
| 1151 | CLOTHES:180 | 3x | Visited clothes shop |
| 1156 | engine | 2x | Lady quest follow-up enabled (dialog complete) |
| 1160 | engine | 4x | Lady invites Alex to Burger Bar |

### Burger Bar (flags 1201–1240)

| Flag | Set by | Checked | Meaning |
|------|--------|---------|---------|
| 1201 | BURGER:301/310 | 14x | Order state machine (0=not ordered, 1=ordered) |
| 1211–1219 | engine | 2x each | Burger quiz answers (9 flags) |
| 1230 | BURGER:153 | 5x | NPC dialog done: waiter |
| 1231 | BURGER:301 | 3x | NPC dialog done: cook |
| 1232 | BURGER:410 | 1x | NPC dialog done: jukebox |
| 1237–1240 | engine | 4x each | Additional quiz answers |

### Apartment / Walt's Room (flags 1301–1321)

| Flag | Set by | Checked | Meaning |
|------|--------|---------|---------|
| 1301 | FLOOR1:110 | 0x | Floor 1 visited |
| 1302 | WALTROOM:110 | 1x | Walt's room discovered |
| 1303 | SAFE:115 | 0x | Safe opened |
| 1308 | SAFE:210 | 0x | Glue applied to safe |
| 1309 | SAFE:130 | 4x | Photo placed on safe |
| 1310 | SAFE:140 | 1x | ID card now visible |
| 1311 | engine | 1x | Safe code entered correctly (dialog) |
| 1312 | APTMENT:130, FLOOR1:150 | 0x | Apartment building visited |
| 1313 | FLOOR1:160, FLOOR2:160 | 0x | Floor transition state |
| 1315 | APTMENT:110 | 3x | Envelope scene in apartment |
| 1321 | WALTROOM:240 | 1x | Walt's room safe puzzle initial state |

### Butcher (flags 1401–1423)

| Flag | Set by | Checked | Meaning |
|------|--------|---------|---------|
| 1401 | BUTCHER:161 | 4x | Entered butcher shop |
| 1402 | engine | 4x | Butcher quiz answer |
| 1403 | BUTCHER:130 | 2x | Chicken interaction state |
| 1405 | BUTCHER:130 | 3x | Chicken escaped (arrest risk!) |
| 1406 | BUTCHER:130 | 3x | Chicken cage opened |
| 1407 | engine | 5x | Butcher quiz answer |
| 1412–1413 | BUTCHER:120 | 1x each | Butcher conversation progress |
| 1419–1422 | BUTCHER:170–200 | 4–7x | Riddle chain progress (4 riddles) |
| 1423 | BUTCHER:165 | 6x | All riddles complete |

### Supermarket (flags 1452–1478)

| Flag | Set by | Checked | Meaning |
|------|--------|---------|---------|
| 1452–1456 | engine | 1–6x | Supermarket quiz answers |
| 1457 | SUPER:310 | 2x | First grocery item collected |
| 1458 | SUPER:320/330 | 7x | Grocery collection state (most-checked super flag) |
| 1459 | SUPER:340 | 2x | Third grocery item |
| 1461–1476 | SUPER:370–475 | 0–2x | Shopping list items (16 individual flags!) |
| 1477 | engine | 1x | Old lady quiz answer |
| 1478 | SUPER:230 | 1x | Shopping task complete |

### Hospital Ward (flags 1501–1512)

| Flag | Set by | Checked | Meaning |
|------|--------|---------|---------|
| 1501 | WARD:202 | 4x | Entered hospital ward |
| 1502 | engine | 4x | Ward quiz answer |
| 1503 | WARD:174 | 2x | Walter interaction progress |
| 1510–1512 | engine | 2x each | Ward quiz answers |

### Photographer (flags 1551–1558)

| Flag | Set by | Checked | Meaning |
|------|--------|---------|---------|
| 1551 | PHOTO:170 | 6x | Appointment confirmed |
| 1552 | PHOTO:145 | 4x | Photo taken |
| 1553 | PHOTO:201 | 1x | Phil dialog state |
| 1554 | PHOTO:220 | 2x | Fridge interaction |
| 1555–1558 | PHOTO:140–143 | 1–2x | Scene progression states |

### Zoo (flags 1605–1618)

| Flag | Set by | Checked | Meaning |
|------|--------|---------|---------|
| 1605 | LIONCAGE:240 | 1x | Notebook visible in cage |
| 1606 | LIONCAGE:250/260 | 0x | Lion feeding state |
| 1611 | ZOOBACK:240 | 2x | Chocolate given to monkey area |
| 1612–1613 | engine | 2x each | Zoo quiz answers |
| 1618 | engine | 1x | Zoo quiz answer |

### Factory (flags 1651–1674)

| Flag | Set by | Checked | Meaning |
|------|--------|---------|---------|
| 1651 | LIFTROOM:140 | **10x** | Hammer used on lift machine (**arrest trigger at factory!**) |
| 1652–1653 | engine | 2x each | Factory quiz answers |
| 1654 | LIFTROOM:150/155 | 1x | Lift machine state |
| 1655 | CONTROL:120 | 0x | Control room accessed |
| 1656 | CONTROL:200 | 4x | Brain visible in control room |
| 1657 | engine | 6x | Brain obtained (item flag for BrainIcon) |
| 1674 | LIFTROOM:156 | 2x | Lift room initial state |

### Street / Map (flags 1800–1845)

| Flag | Set by | Checked | Meaning |
|------|--------|---------|---------|
| 1800 | STBUTCHE:260 | 1x | Map obtained |
| 1802 | STZOO:151/185 | 0x | Zoo entrance ticket state |
| 1806–1807 | engine | 1–2x | Street NPC quiz answers |
| 1812 | BURGER:420 | 2x | Jukebox played (costs 10P) |
| 1814 | STHOSP:180 | 0x | Hospital OJ machine used (costs 5P) |
| 1815 | STHOTEL:120 | 0x | Hammer picked up from hotel street |
| 1816 | STBURGER:155 | 1x | Burger street visited |
| 1818 | STHOSP:235 | 0x | Hospital second visit |
| 1824 | engine | 2x | Arrived at Strip Air (first street scene) |
| 1845 | engine | 2x | Street quiz answer |

### Game State (flags 1900–1922)

| Flag | Set by | Checked | Meaning |
|------|--------|---------|---------|
| 1900 | engine | 1x | Opening cutscene already played (skip on replay) |
| 1901–1922 | engine | 0–7x | **Item acquisition flags** (see Item Lifecycle table above) |

## Flag Patterns

### Consistency Checks
The game cross-references player answers across scenes:
- **Flag 1017** (airport: "on holiday"): Checked at StChoco guard (10 locations!)
  and Floor1 NPCs. Saying something inconsistent → arrest or rejection.
- **Flag 1027** (front desk answer): Cross-checked at hotel check-in.

### Arrest Triggers
Flags that can lead to immediate arrest (`C,snArrest,CODE`):
- **1009=0** at AIRPORT:325 — wrong bag identified
- **1012/1013** at AIRPORT:430 — too many passport attempts
- **1405/1406** at BUTCHER — chicken cage mistakes
- **1651=1** at factory (STCHOCO:250) — hammer already used
- **1311=0** at ROOM303:121 — wrong safe code

### State Machines
Some flags encode multi-step state machines:
- **1076** (Room 302 light): Set to -1 (toggle), checked 12 times
- **1201** (Burger order): 14 checks, tracks full ordering sequence
- **1419–1422** (Butcher riddles): 4-step chain, each must complete in order

### Engine-Only Flags (65 flags)
These are never set by SCX `F` commands — the dialog engine sets them
automatically when quiz answers are correct. They gate subsequent dialog
branches and NPC behavior.

### Never-Checked Flags (26 flags)
Set by SCX but never tested in any condition. These are likely:
- State bookkeeping (e.g., 1301 "Floor 1 visited" — used only for save state)
- Consumed by the engine directly (not via SCX condition checks)
- Safety markers (e.g., 1120 "lockpick state" — set to prevent re-triggering)
