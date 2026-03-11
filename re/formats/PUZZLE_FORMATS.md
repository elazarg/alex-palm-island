# Puzzle and Special Section Formats in Alex Palm Island SCX Files

This document catalogs all interactive puzzle, text-input, form, and special
section formats found in the game's SCX scene scripts.

## Section ID Format

The section "ID" line (first line after the 0xFE delimiter) is actually a
comma-separated tuple of parameters:

```
section_number, type, [param3]
```

- **section_number**: Unique numeric ID within the file
- **type**: Determines how the engine interprets the section
- **param3**: Context-dependent (sound resource for type 1, always "0" for type 4,
  sound resource for type 5, "ALTalk"/"ALTel" for dialog sections)

Sections with a bare number (no commas) are **data sections** -- their content
format is determined by the code that references them via L (Load) commands.


## Section Types

| Type | Name | Count | Description |
|------|------|-------|-------------|
| 1 | Narration text | ~450 | `id,1,sdNarNNN` -- narrator voiceover with text |
| 4 | Zoom/close-up | 78 | `id,4,0` -- display a sprite as close-up view |
| 5 | Inventory desc | 21 | `id,5,sdNarNNN` -- inventory item with description + sprite |
| (dialog) | Word-ordering | ~140 | `id,flags,ALTalk` or `id,flags,ALTel` -- dialog tree with word puzzles |
| (bare) | Data | varies | Bare number -- text content, puzzle data, animation data |


## Type 1: Narration Text Sections

Format: `section_id, 1, sound_resource`

Body: A single line of English narration text.

```
580,1,sdNar205
This is the "Lost and Found" counter.  People look for lost belongings here.
```

These are triggered by look/touch cursor interactions. The engine plays the
named sound resource (sdNarNNN) while displaying the text.


## Type 4: Zoom/Close-Up Sections (78 total)

Format: `section_id, 4, 0`

Body: `sprite_name, sprite_index`

```
650,4,0
Form,1
```

The engine displays the named sprite as a full-screen or panel close-up view.
The **sprite_index** identifies which close-up graphic to use from the scene's
sprite sheet. These sections are always referenced from interactive sections
via L (Load) commands.

### Complete Catalog of Type 4 Sections

#### Signs and Readable Objects (static display)
| File | SecID | Sprite | Index | Description |
|------|-------|--------|-------|-------------|
| AIRPORT.SCX | 520 | HotelAd | 2 | Hotel advertisement poster |
| AIRPORT.SCX | 530 | OrangeAd | 3 | Orange juice advertisement |
| APTMENT.SCX | 610 | ElectricSign | 1 | Electric company notice |
| BUTCHER.SCX | 590 | Sign | 1 | Butcher shop sign |
| CLOTHES.SCX | 590 | BigSign | 2 | Clothing store sign |
| CLOTHES.SCX | 700 | ShopWindow | 1 | Shop window display |
| CORRIDOR.SCX | 700 | Sign1 | 1 | "Please clean" sign |
| CORRIDOR.SCX | 710 | Sign2 | 2 | "Do not disturb" sign |
| FACTORY.SCX | 570 | B-Danger | 2 | Danger warning sign |
| FACTORY.SCX | 580 | B-Carefu | 1 | Careful warning sign |
| FACTORY.SCX | 590 | B-Worker | 3 | Worker of the month sign |
| LIFTROOM.SCX | 510 | Alarm | 2 | Fire alarm display |
| LIFTROOM.SCX | 515 | Alarm1 | 2 | Fire alarm (broken glass) |
| LIFTROOM.SCX | 540 | LiftPanel | 1 | Lift control panel |
| LOBBY.SCX | 550 | News | 2 | Newspaper close-up |
| LOBBY.SCX | 560 | LiftSign | 3 | Lift sign |
| LOBBYDSK.SCX | 510 | RingSign | 1 | "Ring the bell" sign |
| LOBBYDSK.SCX | 520 | OutSign | 2 | "Out to lunch" sign |
| LOBBYDSK.SCX | 530 | Box102 | 4 | Mailbox 102 message |
| MONKEY.SCX | 560 | HomeSweetHome | 1 | Monkey cage sign |
| ROOM301.SCX | 600 | OpenSuitcase | 1 | Suitcase contents |
| ROOM302.SCX | 620 | NewsBackground | 1 | Newspaper background |
| ROOM302.SCX | 630 | Sign | 2 | Room management sign |
| ROOM303.SCX | 590 | TelephoneSign | 4 | Telephone directory sign |
| STAPART.SCX | 530 | CocoSign | 1 | Coco's Coconuts sign |
| STAPART.SCX | 580 | Top-Big | 2 | Street address sign |
| STBUTCHE.SCX | 510 | GrassSign | 1 | "Don't walk on grass" sign |
| STBUTCHE.SCX | 570 | SgnClose | 2 | "Butcher closed" sign |
| STCHOCO.SCX | 530 | ElecSign | 1 | Electric fence sign |
| STCHOCO.SCX | 570 | ChocSign | 2 | Chocolate factory sign |
| STCHOCO.SCX | 571 | FactorySign | 3 | Factory sign |
| STHOTEL.SCX | 610 | Careful | 1 | Danger/careful sign |
| STRIPAIR.SCX | 600 | InfoSign | 1 | Information sign |
| STSUPER.SCX | 520 | SuperSgn | 4 | Supermarket sign |
| STSUPER.SCX | 530 | ButchSgn | 2 | Butcher direction sign |
| STSUPER.SCX | 535 | BBBBSign | 1 | BBBB restaurant sign |
| STSUPER.SCX | 610 | SgnClose | 3 | Supermarket closed sign |
| STSUPER.SCX | 630 | SGNDONUT | 5 | Doughnut shop sign |
| STZOO.SCX | 520 | ZooSign | 1 | Zoo entrance sign |
| STZOO.SCX | 530 | FotoSign | 2 | Photographer sign |
| STZOO.SCX | 620 | Closed | 3 | Zoo closed sign |
| WALTROOM.SCX | 740 | Article | 2 | Magazine article (panda) |
| WALTROOM.SCX | 900 | SafeClsd | 1 | Safe door close-up |
| ZOOBACK.SCX | 600 | BigBackSign | 3 | Zoo back area sign |
| ZOOBACK.SCX | 610 | CaveSign | 1 | Caveman exhibit sign |
| ZOOBACK.SCX | 620 | LionSign | 2 | Lion exhibit sign |
| ZOOFRONT.SCX | 610 | BearSign | 2 | Bear exhibit sign |
| ZOOFRONT.SCX | 630 | MonkeySign | 3 | Monkey exhibit sign |
| ZOOFRONT.SCX | 660 | BigBackSign | 1 | Zoo front sign |

#### Supermarket Products (price tags)
| File | SecID | Sprite | Index | Description |
|------|-------|--------|-------|-------------|
| SUPER.SCX | 600 | Gum | 1 | Chewing gum (13P) |
| SUPER.SCX | 610 | BarOfChocolate | 2 | Chocolate bar (28P) |
| SUPER.SCX | 620 | Candy | 3 | Bag of sweets (19P) |
| SUPER.SCX | 630 | Lollipop | 4 | Lollipop (3P) |
| SUPER.SCX | 650 | Tomatoes | 5 | Canned tomatoes (72P) |
| SUPER.SCX | 660 | Peas | 6 | Canned peas (93P) |
| SUPER.SCX | 670 | Olives | 7 | Canned olives (91P) |
| SUPER.SCX | 680 | Carrots | 8 | Canned carrots (67P) |
| SUPER.SCX | 690 | Corn | 9 | Canned corn (82P) |
| SUPER.SCX | 700 | Tissues | 10 | Box of tissues (31P) |
| SUPER.SCX | 710 | ToiletPaper | 11 | Toilet paper (48P) |
| SUPER.SCX | 720 | Papertowels | 12 | Paper towels (39P) |
| SUPER.SCX | 730 | WrappingPaper | 13 | Wrapping paper (52P) |
| SUPER.SCX | 820 | DozenEggs | 14 | Carton of eggs (103P) |
| SUPER.SCX | 840 | Cheese | 15 | Kilo of cheese (78P) |
| SUPER.SCX | 850 | MilkCarton | 16 | Carton of milk (38P) |
| SUPER.SCX | 855 | Ch-Milk | 17 | Chocolate milk (45P) |
| SUPER.SCX | 860 | Butter | 18 | Packet of butter (40P) |
| SUPER.SCX | 880 | BigSign | 19 | Store sign |

#### Special Close-ups (interactive context)
| File | SecID | Sprite | Index | Description |
|------|-------|--------|-------|-------------|
| AIRPORT.SCX | 650 | Form | 1 | Lost-and-found text input form |
| BURGER.SCX | 600 | BagOpen | 1 | Open bag view |
| LOBBYDSK.SCX | 600 | Form | 3 | Hotel guest book selection form |
| ROOM303.SCX | 800 | TV-OJ0 | 1 | TV showing OJ commercial |
| ROOM303.SCX | 810 | TV-PH0 | 2 | TV showing photographer ad |
| ROOM303.SCX | 820 | Phone | 3 | Telephone dial pad |
| INVENT.SCX | 503 | CouponPict | 24 | Coupon close-up |
| INVENT.SCX | 504 | ZooCouponPict | 25 | Zoo coupon close-up |
| INVENT.SCX | 514 | EnvelopePict | 23 | Envelope close-up |
| INVENT.SCX | 800 | Letter | 0 | Spy Master's letter |

### Sprite Index Meaning

The sprite index (second field in the body) is a **1-based index** into the
scene's close-up sprite sheet. Index 0 is used only for INVENT.SCX's Letter
section and may indicate a special full-screen rendering mode. The same index
can appear across different scenes since each scene has its own sprite set.


## Type 5: Inventory Description Sections (21 total)

Format: `section_id, 5, sound_resource`

Body: Two lines -- description text, then sprite name.

```
501,5,sdNar481
This is your passport.
PassportPict
```

All 21 type-5 sections are in INVENT.SCX and describe the player's collectible
items. The engine displays the sprite as a close-up and plays the narration.

| SecID | Sound | Sprite | Item |
|-------|-------|--------|------|
| 501 | sdNar481 | PassportPict | Passport |
| 502 | sdNar482 | LetterPict | Letter from Spy Master to Walter |
| 505 | sdNar483 | ChocolatePict | Chocolate (bitten) from old man |
| 506 | sdNar484 | CreditPict | Credit card |
| 507 | sdNar485 | Key303Pict | Key to room 303 |
| 508 | sdNar486 | PinPict | Safety-pin |
| 509 | sdNar487 | DrawerKeyPict | Key from pillow in room 302 |
| 510 | sdNar488 | GluePict | Bottle of glue |
| 511 | sdNar489 | BurgerPict | Big Bob Burger |
| 512 | sdNar490 | DrinkPict | Orange juice |
| 513 | sdNar491 | EggPict | Egg from chicken |
| 515 | sdNar492 | BeefPict | Kilo of beef |
| 516 | sdNar493 | HotdogPict | Hotdog |
| 517 | sdNar494 | NoteBookPict | Walter's diary |
| 518 | sdNar495 | PicturePict | Alex's picture |
| 519 | sdNar496 | MilkPict | Carton of milk |
| 520 | sdNar497 | PeanutPict | Bag of peanuts |
| 521 | sdNar498 | IdCardPict | New ID card |
| 522 | sdNar499 | ZooPassPict | Full-day zoo pass |
| 523 | sdNar500 | HammerPict | Heavy hammer |
| 524 | sdNar501 | BrainPict | Bubble-Brain computer |

Note: Inventory items 503 (CouponPict) and 504 (ZooCouponPict) and 514
(EnvelopePict) use type 4 instead of type 5, which means they display as
close-ups without narration.


## Dialog / Word-Ordering Sections (ALTalk / ALTel)

Format: `section_id, flags, ALTalk` or `section_id, flags, ALTel`

These sections implement the game's primary language-learning puzzle: the player
must arrange scrambled words into a correct sentence.

### Dialog Section Structure

```
speaker_sprite x,y,sound_resource     <- line 1: NPC portrait + audio
NPC's spoken line                      <- line 2: what the NPC says
template with @ placeholders           <- line 3: sentence with blanks
word_count                             <- line 4: number of word choices
word_1                                 <- line 5+: scrambled word options
word_2
...
answer_count                           <- line N: number of answer branches
condition,flag,goto_section,sound      <- answer 1 (wrong)
answer_text                            <- wrong answer display text
condition,flag,goto_section,sound      <- answer 2 (correct)
correct_text                           <- correct answer display text
0                                      <- terminator
```

### Template Format

The `@` symbols in the template mark positions where the player must drag words:
- `@ @ @ @` = 4 blanks, player must arrange 4 words
- `@ Palmettoes.` = 1 blank (numeric answer for cashier quiz)
- `I want @.` = 1 blank (choice selection)

### Answer Branch Format

Each answer branch: `condition,flag,goto_section,sound_resource`
- condition: state flag to check (0 = always)
- flag: required flag value (0 or 1)
- goto_section: next section ID (0 = end conversation)
- sound: Alex's voiceover sound

The special entry `2,0,0,Silence` represents the "wrong answer" branch (silence,
no progression). An entry starting with `1,` is the correct answer.

### ALTalk vs ALTel

- **ALTalk** (137 sections): Face-to-face conversations
- **ALTel** (3 sections, ROOM303.SCX only): Telephone conversations

The only mechanical difference is the portrait display mode. ALTel sections
appear only in the telephone-dialing puzzle flow.

### Flags Field (Second Parameter)

The flags field in the section ID appears to be a **state prerequisite bitmask**:
- `0` = no prerequisite (first dialog in a chain or standalone)
- Non-zero values (e.g., 1304, 1047, 1452) reference game state variables
  that must be set before this dialog section activates

This controls dialog progression: the player must complete earlier dialogs
to unlock later ones.


## Puzzle Catalog

### 1. Airport Lost-and-Found Form (AIRPORT.SCX)

**Type**: Multi-field text input form

**Flow**: Section 324 triggers `L,650` which loads section `650,4,0` (Form,1).
The form fields are defined in data section 830:

```
830 (6 lines):
  What is your name?
  What did you lose?
  What size is it?
  What colour is it?
  Palm Island Airport
  Lost and Found
```

Section 800 provides the error hint: "Remember! Capital letters!"

The player types answers to each field. The correct answers come from the
dialog tree in sections 2100-2310, where the player previously described
the lost bag (big/medium/small, color, etc.). The form validates that the
typed answers match the dialog choices.


### 2. Hotel Guest Book Form (LOBBYDSK.SCX)

**Type**: Multiple-choice selection form

**Flow**: Section `600,4,0` loads Form,3 (sprite index 3). The form options
are defined in data section 800:

```
800 (11 lines):
  The Grand Hotel
  Why are you here?
  business
  holiday
  What kind of room do you want?
  single
  shower
  telephone
  double
  bath
  no telephone
```

This is a **selection form** (not free-text input). The player chooses from
predefined options. The form has two questions:
1. "Why are you here?" -- business / holiday
2. "What kind of room do you want?" -- single or double, with sub-options
   for shower/bath and telephone/no telephone.

The dialog tree (sections 2010-2030) establishes the expected answers.


### 3. Telephone Dial Pad (ROOM303.SCX)

**Type**: Numeric dial interface

**Flow**: Section `820,4,0` loads Phone,3 (sprite index 3). The phone
directory is in data section 850:

```
850 (5 lines):
  The Grand Hotel
  1 - Front desk
  2 - Room service
  3 - Information
  For an outside line, dial nine.
```

Additional phone destinations (data sections):
- 860: "Drink Island Orange Juice / It's good for you!" (OJ commercial)
- 870: "By appointment only. / If the line is busy, call again." (photographer)

The player dials numbers (1, 2, 3, or 9+number) to reach different
destinations. Dialing the photographer's number (from section 870, obtained
through the STZOO sign "If you are young, if you are old...") triggers the
ALTel dialog chain.

Section 830 ("Sorry, the line is busy") and 840 ("Sorry, nobody is answering")
provide wrong-number feedback.

Anti-cheat: PRISON.SCX section 524 says "You cheat! Did a friend give you
that telephone number?" -- the game detects if the player dials the correct
outside number without having seen the clue.


### 4. Safe Code Entry (WALTROOM.SCX)

**Type**: Letter-code input (hex-valid letters)

**Flow**: Section `900,4,0` loads SafeClsd,1 (safe door close-up). The
correct code is in data section 910:

```
910 (1 line):
  FEEDBIGBADDAD
```

The code uses only hex-valid letters (A-F plus D). The player must enter
this 13-character code. The solution comes from the Spy Master's letter
(INVENT.SCX section 870):

```
870 (6 lines):
  I just wanted to let you know:
  Rudolph eats doughnuts.
  Brad lost Urma's eraser.
  Grandma Rosy exercises every night.
  Yolanda Evergreen loves L. O. Williams.
  Cindy
```

Reading the first letters of key words spells out clues. The player also
needs information from the lion sign (ZOOBACK.SCX section 810) which
mentions "Big Bad Dad".

Anti-cheat: PRISON.SCX section 525 says "You cheat! Did a friend give you
the code to the safe?"


### 5. Panda Magazine Drag-and-Drop (WALTROOM.SCX)

**Type**: Word placement puzzle (drag words to correct positions)

**Trigger**: The magazine article (section `740,4,0`, Article,2) shows a
coffee-stained magazine. Section 810 hints: "Drag the words at the bottom
of the screen to the right place."

**Article text** (data section 820, 18 lines):
```
The Giant Panda lives in China.
The Giant Panda lives in China.
It eats only bamboo shoots.
It eats only bamboo shoots.
When there are not enough bamboo shoots, many pandas die.
When there are not enough bamboo shoots, many pandas die.
When there are not enough bamboo shoots, many pandas die.
There are not many pandas left in the world.
There are not many pandas left in the world.
There are not many pandas left in the world.
The Giant Panda is the symbol of the World Wide Fund for Nature.
The Giant Panda is the symbol of the World Wide Fund for Nature.
The Giant Panda is the symbol of the World Wide Fund for Nature.
It stands for all the animals we want to save in nature.
It stands for all the animals we want to save in nature.
It stands for all the animals we want to save in nature.
Picture taken by Phil the Photographer tel. 201936.
The Giant Panda
```

The repeated lines suggest **text wrapping data**: each line represents one
display row of the rendered article. The engine word-wraps the article text
and some words are "erased" (by the coffee stain).

**Drag-and-drop definition** (data section 920):
```
5                          <- number of draggable words
245,145,animals            <- x, y, word
177,25,China
308,40,not
228,25,eats
230,130,Nature
```

Format: `count` on line 1, then `x_position, y_position, word` for each
draggable word. The coordinates specify where each word belongs in the
article image. The player drags the words from a word bank at the bottom
of the screen to their correct positions.

The 5 missing words are: **animals, China, not, eats, Nature** -- all key
vocabulary from the article about the Giant Panda.


### 6. Cashier Price Quiz (SUPER.SCX)

**Type**: Multiple-choice number answers via dialog tree

**Flow**: The cashier asks Alex to read prices off the shelves. This uses
the standard ALTalk word-ordering format but with numeric answers.

**Price database** (data sections 910-927):
| Section | Item | Price |
|---------|------|-------|
| 910 | Bar of chocolate | 28 Palmettoes |
| 911 | Chewing gum | 13 Palmettoes |
| 912 | Bag of sweets | 19 Palmettoes |
| 913 | Lollipop | 3 Palmettoes |
| 914 | Tomatoes | 72 Palmettoes |
| 915 | Peas | 93 Palmettoes |
| 916 | Olives | 91 Palmettoes |
| 917 | Carrots | 67 Palmettoes |
| 918 | Corn | 82 Palmettoes |
| 919 | Tissues | 31 Palmettoes |
| 920 | Toilet paper | 48 Palmettoes |
| 921 | Paper towels | 39 Palmettoes |
| 922 | Wrapping paper | 52 Palmettoes |
| 923 | Eggs | 103 Palmettoes |
| 924 | Cheese | 78 Palmettoes |
| 925 | Milk | 38 Palmettoes |
| 926 | Chocolate milk | 45 Palmettoes |
| 927 | Butter | 40 Palmettoes |

Section 930 advertises "Special Sale! Eggs!"

The cashier asks 5 questions (sections 2030-2070), each with 4 numeric choices.
The player must match the price from the close-up views. The total is 275
Palmettoes (section 1030: "That will be 275 Palmettoes").

Questions asked:
1. Can of peas? (93) -- choices: 9, 19, 39, 93
2. Bar of chocolate? (28) -- choices: 12, 20, 28, 82
3. Toilet paper? (48) -- choices: 4, 8, 40, 48
4. Lollipop? (3) -- choices: 3, 13, 30, 33
5. Carton of eggs? (103) -- choices: 13, 100, 103, 130

Note: The distractors are carefully designed as common misreadings of the
English number words (digit reversals, partial matches).


### 7. Newspaper Missing Letters (LOBBY.SCX)

**Type**: Letter-input quiz

**Flow**: When the old man shows Alex the newspaper, sections 740-760 define
the puzzle. The newspaper article (section 760) about a lion keeper was
printed with two broken letters on the printing press.

```
740: Two letters on the printing press are broken.
     One is a vowel, the other is a consonant.  Which vowel is missing?
750: Which consonant is missing?
```

The player must identify which vowel and consonant are missing from the
rendered newspaper text. Error messages are in sections 700-730:
- 700: "That is not the missing vowel!"
- 710: "That letter is not a vowel! It's a consonant."
- 720: "That is not the missing consonant!"
- 730: "That letter is not a consonant! It's a vowel."

The article text (section 760) contains the full text with repeated lines
for rendering:
> "A lion keeper was badly hurt yesterday morning. He was giving the lion
> some frozen meat for breakfast, when the animal jumped at him and said:
> 'I don't like it! Eat it yourself!' People are saying that the lion
> keeper's bad luck is because he does not believe in chain letters."

The player examines the rendered newspaper (where two letters appear as
blanks or garbled) and types the missing vowel and consonant.


### 8. Newspaper Jigsaw (ROOM302.SCX)

**Type**: Drag-and-drop tile rearrangement

**Flow**: Section 991 says "The newspaper is torn. Put the pieces in the
right order." Section 992 says "Hold the mouse button down and drag each
piece to the right place."

The torn newspaper text (data section 993):
> "An eyewitness said: 'I couldn't really see his face, but I could see
> his hair. It's short and curly. I think his eyes are black, but I'm not
> sure. I also remember his nose. It's big. Really big!'"

This provides a description of a suspect. The player must physically
rearrange torn newspaper pieces to read the complete article. The assembled
text gives clues for a later puzzle.


### 9. Chocolate Factory Code (LIFTROOM.SCX + FACTORY.SCX)

**Type**: Button-press sequence puzzle

**Flow**: The lift panel (section `540,4,0`, LiftPanel,1) requires a code
to operate. The code is in data section 910:

```
910 (1 line):
  EBAHIAFCD
```

The code letters map to the chocolate factory recipe steps, defined in
data section 800:

```
800 (9 lines):
  mix          <- position 1
  sugar        <- position 2
  wrap         <- position 3
  pack         <- position 4
  chocolate    <- position 5
  taste        <- position 6
  margarine    <- position 7
  milk         <- position 8
  peanuts      <- position 9
```

Each letter in "EBAHIAFCD" is a 1-based index (A=1, B=2, ..., I=9) into
the recipe list. Decoding: E=5(chocolate), B=2(sugar), A=1(mix),
H=8(milk), I=9(peanuts), A=1(mix), F=6(taste), C=3(wrap), D=4(pack).

This gives the full recipe order: **chocolate, sugar, mix, milk, peanuts,
mix, taste, wrap, pack**.

The player learns the recipe fragments through the FACTORY.SCX dialog tree:
- Worker A (section 2020): "chocolate... sugar... mix..."
- Worker B (section 2040): "milk and peanuts... then mix!"
- Worker C (section 2070): "taste... wrap... pack!"

Anti-cheat: PRISON.SCX section 526 says "You cheat! Did a friend give you
the code?" and section 522 says "Before you press the buttons, find the
right order!"


### 10. Coupon / Sign Text Reading (various)

**Type**: Static text display from data sections

Many data sections (700-899 range, bare IDs) contain text that appears
on signs, coupons, and readable objects when viewed via type-4 close-ups.
These are not puzzles per se, but several contain clues for other puzzles:

| File | Section | Content | Clue for |
|------|---------|---------|----------|
| INVENT.SCX | 850 | Zoo coupon: 10% discount | Zoo pass quest |
| INVENT.SCX | 860 | Burger coupon: free OJ | Burger quest |
| INVENT.SCX | 870 | Spy letter with acrostics | Safe code |
| LOBBYDSK.SCX | 720 | Box 102 poem (red herring) | -- |
| LOBBY.SCX | 998-999 | Credit card / cash prices | Hotel payment |
| STZOO.SCX | 810 | Photographer's ad poem | Phone number clue |
| ZOOBACK.SCX | 810 | Lion sign: "Big Bad Dad" | Safe code clue |
| SUPER.SCX | 930 | "Special Sale! Eggs!" | Cashier quest |


## Special Section: ALEX1.SCX Walk Animation Data

ALEX1.SCX contains a unique section with the ID line:
```
0,0, 0,0, -8,0, 0,6, 0,0, -8,5, -8,4, 0,0, 0,0,
```

This is NOT a type-4 or type-5 section. It contains 9x9 grids of delta
values that define Alex's walking animation offsets for different directions.
The comma-separated ID is actually the first row of the data matrix.


## Summary of Input Mechanisms

| Puzzle | Input Type | Engine Feature |
|--------|-----------|----------------|
| Airport form | Free-text typing | Text input fields |
| Hotel guest book | Selection from options | Radio-button form |
| Phone dial | Numeric keys | Keypad interface |
| Safe code | Letter typing (A-F, D) | Text input field |
| Panda magazine | Drag words to positions | Drag-and-drop |
| Cashier quiz | Choose from 4 numbers | Dialog word-ordering |
| Newspaper letters | Type single letters | Text input field |
| Newspaper jigsaw | Drag torn pieces | Drag-and-drop tiles |
| Chocolate factory code | Press buttons in order | Button sequence |
| All dialog trees | Arrange scrambled words | Dialog word-ordering |

The game uses 5 distinct input mechanisms:
1. **Free-text fields** (airport form, safe code, newspaper letters)
2. **Selection forms** (hotel guest book)
3. **Numeric keypad** (telephone)
4. **Drag-and-drop** (panda magazine words, newspaper jigsaw)
5. **Dialog word-ordering** (all ALTalk/ALTel conversations, cashier quiz)

Mechanism 5 (word-ordering) is the most common, appearing in 140 dialog
sections across 20+ scene files. It is the game's primary language-learning
interaction.
