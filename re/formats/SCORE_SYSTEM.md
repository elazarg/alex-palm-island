# Palmettoes Score/Currency System

The game "Alex Palm Island" uses a currency called **Palmettoes** as both score
and in-game money. The player starts with **100 Palmettoes**. SCX `P` commands
encode the game's explicit scene-side charges, while at least some positive
rewards are handled by engine-side dialog/talk logic. The game ends in prison
if the balance reaches zero.

## Overview

- Starting balance: **100 Palmettoes**
- Total possible penalties (all P commands): **-560 Palmettoes**
- Positive P commands found: **0** (none in any SCX or DCX file)
- Positive rewards are handled by the engine's dialog logic rather than by SCX
  `P` commands.

## P Command Format

Interactive sections (100-499) use the format:

    flag_id,condition,P,amount

where `flag_id=0,condition=0` means unconditional. All observed amounts are
negative integers. The engine subtracts from the player's Palmettoes balance.

## Complete Penalty Table

| Scene    | Section | Amount | Trigger / Context | Mandatory? |
|----------|---------|--------|-------------------|------------|
| AIRPORT  | 229     | -15    | Passport officer fee ("That will be fifteen Palmettoes. Have a nice stay!") | YES -- entering the island |
| AIRPORT  | 325     | -10    | Lost-and-found bag retrieval ("Here is your bag. You have to pay to play. That'll be ten Palmettoes.") | YES -- getting your bag |
| LOBBYDSK | 150     | -40    | Hotel room payment ("Not any more! That will cost you forty Palmettoes - in cash!") | YES -- getting room key |
| BURGER   | 130     | -50    | Buying a burger at Big Bob's ("You have to pay to play. That'll be fifty Palmettoes.") | YES -- needed for game progression |
| PHOTO    | 170     | -50    | Getting photo taken by Phil ("That will be 50 Palmettoes. Have a seat.") | YES -- photo needed for spy mission |
| STZOO    | 185     | -50    | Zoo ticket purchase ("Here is your ticket. Hold on to it! That will be 50 Palmettoes.") | YES -- zoo access required |
| SUPER    | 290     | -275   | Supermarket groceries for old lady ("Thank you, young man, for all your help. That will be 275 Palmettoes.") | YES -- required task |
| BUTCHER  | 125     | -15    | Buying beef ("One kilo of beef coming up!" at 15 Palmettoes/kg) | YES -- needed for progression |
| BUTCHER  | 126     | -10    | Buying hotdogs ("One kilo of hotdogs coming up!" at 10 Palmettoes/kg) | Likely YES |
| BUTCHER  | 161     | -10    | Chicken escape fine ("That was my chicken you let out of the cage. Pay me 10 Palmettoes or I'll call the police!") | YES -- chicken quest step |
| STCHOCO  | 250     | -10    | Buying gum from guard ("10 Palmettoes. Would you like a piece?") | YES -- needed for chocolate factory entry |
| STSUPER  | 111     | -10    | Buying a doughnut ("That'll be 10 Palmettoes.") | Possibly optional |
| STHOSP   | 140     | -5     | Drinking orange juice from vending machine | Possibly optional |
| BURGER   | 210     | -10    | Playing the jukebox (walks to jukebox, animation plays) | Possibly optional |

### Penalty Summary by Category

**Mandatory story costs (cannot complete game without paying):**

| Cost  | Purchase               |
|-------|------------------------|
| -15   | Airport entry fee      |
| -10   | Bag retrieval fee      |
| -40   | Hotel room             |
| -50   | Burger                 |
| -50   | Photo                  |
| -50   | Zoo ticket             |
| -275  | Supermarket groceries  |
| -15   | Beef (butcher)         |
| -10   | Hotdogs (butcher)      |
| -10   | Chicken fine (butcher) |
| -10   | Gum (chocolate factory)|
| **-535** | **Subtotal**        |

**Possibly optional costs:**

| Cost  | Purchase               |
|-------|------------------------|
| -10   | Doughnut (STSUPER)     |
| -5    | Orange juice (STHOSP)  |
| -10   | Jukebox (BURGER)       |
| **-25** | **Subtotal**         |

**Grand total: -560 Palmettoes**

## Budget Analysis

Starting balance: **100 Palmettoes**.

The full penalty table totals far more than the starting balance. In practice,
the game relies on **dialog-driven rewards** to replenish Palmettoes; without
them the player would go bankrupt almost immediately.

### Dialog Rewards vs Y Command Hints

There are **15 Y commands** in `GLOBAL.SCX`, but these are not the main reward
system. They implement first-use vs repeat text branching for inventory misuse
responses. The actual Palmettoes rewards are tied to dialog completion in the
engine, not to explicit `P` commands and not directly to `Y`.

What is supported by the local evidence:

- The SCX corpus contains a large number of `ALTalk` / `ALTel` dialog sections
  with answer templates, so the reward system is substantially broader than the
  15 `Y` commands in `GLOBAL.SCX`.
- Airport talk flows already show that Palmettoes changes are not quiz-only:
  the passport officer charges 15 Palmettoes, the lost-and-found clerk charges
  10 for returning the bag, and other talk outcomes can also change money.
- For the airport fee cases, the actual charges are explicit SCX penalties:
  `AIRPORT.SCX` section `225/226` leads to section `229` (`P,-15`) and section
  `325` contains `P,-10` for the bag handoff.
- So the engine-side Palmettoes logic is currently best treated as an additional
  reward/special-charge mechanism layered on top of normal SCX `P,-N` charges,
  not as the universal source of all dialog-related money changes.
- `GAME_CONTENT.md` identifies over a hundred quiz-style dialogs across the game,
  which is consistent with normal play being economically viable even though the
  raw penalty sum is -560.

### Minimum Palmettoes Needed

Using the critical-path cost model from `GAME_CONTENT.md`, the unavoidable spend
is about **-225**, which means the player only needs roughly **+125** in rewards
to complete the game from the 100-Palmettoes starting balance. That is consistent
with a dialog-reward system spread across many scenes.

The trigger policy is now much narrower than it first looked:

- explicit payments are overwhelmingly SCX-driven via `P,-N`
- the confirmed engine-side talk reward path is a fixed `+10`
- the reward-bearing dialogs are the **113 quiz-style `ALTalk` / `ALTel`
  sections with `2,0,0,Silence` wrong-answer branches and a non-zero
  `completion_flag` in the section header**
- the lone quiz-style non-reward exception is `STCHOCO.SCX` section
  `2060,0,ALTalk`, which is just the "How much is the bubble gum?" prompt that
  leads into the explicit purchase flow at `2070` / `250` (`P,-10`)

So the engine-side reward path is best treated as a **quiz reward hook in the
ALTalk runtime**, not a general-purpose replacement for all Palmettoes changes.
At gameplay level, the rule is close to complete: reward-bearing quiz sections
pay `+10`, while normal costs remain script-side debits.

### Binary Evidence for a Shared Reward/Penalty Helper

The unpacked executable contains a concrete money-delta helper at **0x3763**:

- It takes a signed argument.
- It adds that delta to a 32-bit **target** value stored at object offsets `+0x26A/+0x26C`.
- It then calls into lower-level UI update logic.

The helper it feeds at **0x35ED** appears to synchronize a second 32-bit pair at
`+0x266/+0x268`, which looks like the **current/displayed** value. In other words,
the engine appears to maintain both a target Palmettoes value and a currently
displayed value, allowing the number to animate toward its new total.

That same lower-level path also contains bounds logic that prevents the value
from going negative.

One confirmed caller in the unpacked binary pushes **`0x0A`** before calling
this helper:

```asm
05A6D: 6A 0A                push 0x0a
05A6F: ...
05A76: E8 EA DC             call 0x3763
```

There is also a second confirmed caller that pushes **`0xFB`** (signed `-5`)
before calling the same helper:

```asm
085A1: 6A FB                push -5
085A3: ...
085AA: E8 B6 B1             call 0x3763
```

That `-5` path is **not** in the talk subsystem. It sits next to the strings:

- `The dictionary costs 5 Palmettoes.  Are you sure you want to use it?`
- `REMEMBER!  The dictionary costs 5 Palmettoes.  Are you sure you want to use it?  (We won't remind you again.)`

So the helper at `0x3763` is clearly a generic signed money helper used by more
than one subsystem. The only confirmed **dialog/talk-side** caller remains the
`+10` wrapper at `0x5A76`, but the SCX corpus now makes its scope much clearer:
it lines up with the reward-bearing quiz dialogs rather than with generic talk
outcomes.

### Why the `+10` Caller Looks Dialog-Related

The confirmed `+10` caller sits inside a larger function at **0x59BE**. The
string neighborhood immediately following that function includes:

- `ItemList`
- `NumberList`
- `TalkMask1`

Nearby dialog/UI strings elsewhere in the same region include:

- `TalkMask2`
- `Silence`
- `HearWindow`

This makes it much more likely that the `0x59BE` wrapper belongs to the
dialog/talk subsystem rather than to generic UI code. Combined with the SCX
scan, it narrows the trigger policy to reward-bearing quiz sections rather than
to arbitrary conversations.

One important refinement from the adjacent talk code: the nearby runtime field
at `+0x1D6` is probably **not** the Palmettoes amount itself. A sibling function
starting at `0x5B4B` stores a new value into `+0x1D6`, compares it to `0x10`,
and dispatches through the pointer at `+0x1D8`. That usage fits a small talk
result/state code much better than a literal money delta. The signed amount is
still selected elsewhere before the call into `0x3763`.

That same sibling path is now a bit clearer in raw disassembly:
- it stores a helper result into `+0x1D6`
- checks whether `+0x1D6 == 0`
- if zero, calls method `+0x30` on the object at `+0x1D8`
- if nonzero, calls method `+0x34` on that same object

So `+0x1D6` is strongly behaving like a compact talk result/mode code that
drives UI/runtime dispatch, not like a money amount.

Another adjacent refinement: runtime pair `+0x1DC/+0x1DE` behaves like a live
far pointer to the current talk node/entry. Multiple talk functions load that
pointer, follow fields on the pointed object, and write it back after updates.
The helper at `0x6975`, which is used from both event dispatch and talk UI
building, now looks more specifically like a dialog-object bridge rather than a
money helper. In the unpacked binary it:
- checks object fields `+0x30/+0x32`
- if `+0x30` is nonzero, forwards that pair into the dialog object at global
  `0x361E`
- then calls helper `0x8201` against a separate global object at `0x2FFE`
- and finally writes a small byte result back into the caller-side object state

That fits talk-option state or mask handling much better than direct money
logic.

The current-node path is now a bit clearer:

- builder code around `0x60C9` seeds `+0x1DC/+0x1DE` from a temporary node
- it then copies values into node-local fields such as `+0x19/+0x1B` and
  `+0x1E/+0x20`
- the same constructor path then consumes one more 16-bit value from the same
  serialized talk-data reader and writes it into live field `+0x1D2` at
  `0x61AF` before activating the dialog object at `+0x18F`
- the loop at `0x627C` repeatedly reloads the current node pointer, uses
  pointed-node fields `+0x15/+0x17/+0x1E/+0x20`, and writes the pointer back

That narrows the remaining constructor-side question: the initial `+0x1D2`
value is no longer an opaque helper return from unrelated runtime code. It is
part of the same talk-data construction path that fills the node fields, even
if its exact semantic name is still unresolved.

So the unresolved question is no longer which gameplay flows can reward money;
it is only where the reward-bearing property from the dialog section gets copied
into runtime talk-node state before the call into `0x3763`.

The node field layout is now also narrower by comparison with the SCX answer
record format:
- node word `+0x19` is very likely the runtime copy of the dialog header's
  `completion_flag`
- node word `+0x1B` is very likely the runtime copy of `goto_section`
- node byte `+0x1D` is very likely the runtime copy of the answer `result`
  code (`1 = correct`, `2 = wrong`)

Why this fit is strong:
- after the wrapper processes node `+0x1B`, it checks whether node `+0x19` is
  nonzero and only then calls the dialog object at global `0x361E` with that
  value
- that matches the SCX distinction between reward-bearing quiz dialogs
  (`completion_flag != 0`) and the lone nonreward quiz-like prompt
  `STCHOCO 2060,0,ALTalk`
- the reward wrapper reads node byte `+0x1D` and has a special path when it is
  exactly `1`, which matches the SCX "correct answer" value
- later in the same wrapper, node word `+0x1B` is compared against `2000`
  and then copied into live fields `+0x1D2` or `+0x1D4`
- that matches the SCX meaning of `goto_section`: values `>= 2000` continue
  dialog chains, while lower values route into normal interactive/text sections

**RESOLVED:** The write to node `+0x1D` is now identified. The node builder at
`0x60ED` makes three sequential calls to the stream reader `0x106d:0x136`, each
returning the next serialized field from dialog data. The results are stored to
the node in order:

| Call addr | Returns | Stores to | Field |
|-----------|---------|-----------|-------|
| 0x6105 | answer result | node+0x1D | 1=correct, 2=wrong |
| 0x6112 | completion flag | node+0x19 | reward gate |
| 0x611F | continuation target | node+0x1B | next section |

The store to `+0x1D` at offset `0x610E` has its opcode bytes obscured by BP7
inline data (`36 98` instead of the expected `26 89` = ES: MOV), but the
displacement bytes `45 1D` are intact and structurally identical to the `45 19`
and `45 1B` in the other two stores. Followed by link stores to `+0x1E/+0x20`
from `+0x1DC/+0x1DE`.

So node byte `+0x1D` is populated directly from serialized dialog data in the
SCX file during node construction — NOT through a bulk copy or helper. The
value (1=correct, 2=wrong) is the answer-result byte read sequentially from the
talk data stream, one call per field.

This leaves a smaller constructor-side question than before. The runtime no
longer looks opaque; what remains is the exact meaning of the additional
serialized value first written into `+0x1D2` during node construction and how
that interacts with the later `+0x1B -> +0x1D2/+0x1D4` continuation routing.

The `+0x1D2/+0x1D4` split is also a bit less mysterious now:
- the reward wrapper copies node `+0x1B` into `+0x1D2` when the target section
  is `>= 2000`
- otherwise it copies that same node field into `+0x1D4`
- separate scene-side code around `0x5006` reads `+0x1D4`

So the best current model is:
- `+0x1D2` = active dialog-space section token/continuation target
- `+0x1D4` = continuation/handler target when control returns to non-dialog
  scene logic

The constructor order makes that `+0x1D2` reading a bit stronger than before.
Because `0x60C9` consumes the extra 16-bit value *before* allocating the answer
nodes, the strongest current inference is that it is a section-level dialog
token, likely the current dialog section ID or an equivalent dialog-space
continuation value, rather than a per-answer property.

The read side now matches that model. In the event/runtime path around
`0x5540`:
- if `+0x1D2 == 0`, the engine falls back to `0x5006` and the ordinary
  non-dialog section handoff
- if `+0x1D2 != 0`, it first refreshes the talk UI via `0x61F7` and then
  pushes `+0x1D2` into `0x5B3C`

So `+0x1D2` is no longer just "some continuation field". It behaves like the
active dialog-space section token that keeps execution inside the talk runtime.

The non-dialog side is now backed by a concrete runtime handoff:
- scene code around `0x5006` reads `+0x1D4`
- writes it to global `0x29DF`
- and snapshots the current object pointer into globals `0x358A/0x358C`

`ENGINE_ARCHITECTURE.md` already identifies `0x29DF` as the queued
`pending_section_id`, so `+0x1D4` is no longer just a vague "other branch" field:
it feeds the ordinary scene-section dispatcher.

The reward gate itself is now narrower than the earlier draft:
- the wrapper around `0x5A76` first checks live talk field `+0x1D6`
- if `+0x1D6 != 0`, it performs the confirmed `push 0x0A` / `call 0x3763`
- immediately afterward it tests current-node byte `+0x1D`
- if that byte is nonzero, it pushes the current `+0x1D6` value into the
  dialog object at global `0x361E`, writes the returned code back to `+0x1D6`,
  and dispatches through the object at `+0x1D8`

So the live reward edge is best described as:
- talk state code at `+0x1D6`
- gated reward call at `0x5A76`
- followed by current-node byte `+0x1D` and dialog-object dispatch

That still does not reveal the original constructor-side copy into the node, but
it does reduce the remaining gap to one upstream mapping problem.

The dialog object at global `0x361E` is also a bit less abstract now. Across
the currently traced Palmettoes-side helpers it is used for:
- `completion_flag`-driven dialog progression updates
- transforming the live `+0x1D6` talk-state code before dispatch through
  `+0x1D8`
- option/mask-style updates from helper `0x6975` using object fields `+0x30`
  and `+0x32`

So the best current label for `0x361E` is a **dialog controller/state object**
rather than a generic UI pointer.

Whole-binary scanning strengthens that label. Outside the reward wrapper, the
same global also appears in:
- scene/dialog entry wrappers around `0x3AF3` and `0x3BAA`
- a separate dialog/UI path around `0x4063`
- the dictionary-cost branch around `0x8507`

So `0x361E` is not specific to quiz rewards. It looks like the shared
message/dialog controller that both the `+10` quiz reward flow and the `-5`
dictionary charge flow go through.

One previously suspected UI path can now be excluded from the Meter side and
reassigned to dialog rendering instead: the routine at `0x61F7` is a talk-screen
refresh path. It updates several talk UI child objects (`+0x83`, `+0x8B`,
`+0x18F`, `+0x1C7`, `+0x1C3`, `+0x7B`), then iterates the current node via
fields `+0x15/+0x17/+0x1E/+0x20`. So it is relevant to reward timing on dialog
entry, but not to the separate persistent `Meter` object.

### Airport Example: Text in SCX, Money in Engine

`AIRPORT.SCX` is a useful concrete example:

- section `1060`: passport officer text, "That will be fifteen Palmettoes."
- section `1070`: variant passport officer fee text, also 15 Palmettoes
- section `1137`: lost-and-found text, "That'll be ten Palmettoes."
- section `325`: lost-and-found handler with the bag-identification flow and an
  explicit scene-side `P,-10` after the successful bag handoff

The airport case shows that explicit charges can be fully SCX-driven even when
they are presented as dialog. In other words, the economy is split between:

- explicit SCX penalties (`P,-N`)
- engine-side reward/special-charge side effects that call the signed helper at `0x3763`

Whole-core scanning also narrows the engine-side write surface. Direct uses of
the global Palmettoes object pointer at `0x2FFA/0x2FFC` in the unpacked core
collapse to four spots:
- early pointer setup around `0x1474-0x147C`
- the talk reward path at `0x5A6F -> 0x5A76`
- the dictionary money-check path at `0x850B`
- the dictionary charge path at `0x85A3`

That makes the core-side non-SCX Palmettoes logic look very small and
specialized rather than broadly distributed through the executable.

### Current Best RE Model

At this point the highest-confidence overall model is:

1. **Payments / fees**: mostly explicit SCX `P,-N` commands
2. **Dictionary charge**: engine-side special case (`-5`) outside the talk subsystem
3. **Dialog rewards**: engine-side fixed `+10` path inside the talk subsystem
4. **Reward-bearing dialogs**: the 113 quiz-style `ALTalk` / `ALTel` sections
   with `Silence` wrong-answer branches and non-zero `completion_flag`
5. **Excluded quiz-like prompt**: `STCHOCO` section `2060,0,ALTalk` is not a
   reward node; it is a price question that leads into an explicit `P,-10`
   purchase
6. **Reward timing**: the blink happens as part of the dialogue UI, before the
   follow-up text section runs

The remaining low-level gap is not the Palmettoes transfer rule itself, but the
exact runtime field copy that marks a live talk node as reward-bearing before
the call into `0x3763`.

Headless Ghidra decompilation of the constructor path at `0x60C9` strengthens
that exact conclusion. Even through the BP7 corruption, the function clearly
does all of the following through the same serialized-reader helper:

- seeds the live current-node pointer at `+0x1DC/+0x1DE`
- writes a serialized 16-bit value directly into live field `+0x1D2`
- writes node word `+0x19`
- writes node word `+0x1B`
- writes node pair `+0x1E/+0x20`

What it still does **not** expose is a clean direct write to node byte `+0x1D`.
So the best remaining model is now:

- `+0x1D2`, `+0x19`, `+0x1B`, `+0x1E/+0x20` come from visible constructor-side
  serialized reads
- node byte `+0x1D` reaches the live node through a hidden bulk-copy or
  helper-owned constructor path that is not surfaced as a simple core-side store

That makes the remaining Palmettoes-side gap very narrow: not the reward rule,
but the exact implementation bridge for the node `result` byte.

The strongest current candidate for that bridge is now the helper call in the
builder at `0x61AF`. Before the visible writes to `+0x19`, `+0x1B`, and
`+0x1E/+0x20`, the function calls a helper with size argument `0x22` and gets
back the live node pointer it then populates. In other words, the runtime is
materializing a **0x22-byte talk node** before the explicit field stores.

That fits the hidden-byte problem very well:

- the helper-owned materialization step can copy or initialize the full node
- the visible constructor code then overwrites the fields it handles explicitly
  (`+0x19`, `+0x1B`, `+0x1E/+0x20`, plus live `+0x1D2`)
- node byte `+0x1D` can therefore arrive through that initial 0x22-byte node
  materialization without ever appearing as a simple direct store in the
  unpacked core

So the remaining uncertainty is no longer "where could `+0x1D` come from?" but
the much narrower "does the 0x22-byte node materializer copy it directly from
serialized dialog data, or derive it from a small helper-owned template?"

Headless decompilation of the current-node walker at `0x627C` also clarifies the
node layout. The loop repeatedly:

- loads the live current-node pointer from `+0x1DC/+0x1DE`
- reads node fields `+0x15/+0x17`
- copies node fields `+0x1E/+0x20` into a temporary
- performs two helper calls
- writes that saved `+0x1E/+0x20` pair back into `+0x1DC/+0x1DE`

So `+0x1E/+0x20` is now best understood as the **next-node link** used by the
dialog runtime to advance through the live node chain. This is useful because it
separates the node-link fields cleanly from the reward-bearing fields:

- `+0x19` = completion/reward flag candidate
- `+0x1B` = section continuation target
- `+0x1D` = answer result byte (`1` correct, `2` wrong)
- `+0x1E/+0x20` = next live talk-node pointer

That leaves `+0x1D` even more isolated: the runtime reward wrapper reads it, but
the constructor-side visible stores and the node-advance loop do not. The most
likely remaining explanation is still a helper-owned or bulk-copy population step
outside the plainly visible field stores.

One caveat from the data: a few completion-flag values are reused across
different quiz sections (`1830`, `1836`, `1842`), so the reward system should be
counted per **reward-bearing section**, not per unique flag number.

The bundled save samples support this strongly. `re/save_samples/3.GAM` and
`re/save_samples/4.GAM` are both in `snStripAir`, but Palmettoes rises from
`75` to `105` while the set-flag count rises from `8` to `11`. That is exactly
consistent with the three Snow-cat quiz steps awarding `+10` each.

## Bankruptcy and Prison

### Zero-Money Arrest

When the Palmettoes balance reaches zero, the engine triggers a scene change
to `snArrest` with code `500`, which then transitions to `snPrison` (via
`ARREST.SCX` -> `PRISON.SCX`).

**PRISON.SCX section 500** displays:
> "You do not have any money left! Palm Island doesn't like people with no money."

This is one of **26 arrest reasons** in PRISON.SCX (sections 500-526).

### Arrest System (snArrest Codes)

The `C,snArrest,CODE` command triggers an arrest sequence. The CODE maps to
a text section in PRISON.SCX that explains why the player was arrested:

| Code | Scene(s) | Reason |
|------|----------|--------|
| 500  | (engine) | "You do not have any money left!" (bankruptcy) |
| 501  | AIRPORT s227 | "It isn't clever to tell people that you are a spy!" |
| 502  | LOBBYDSK s150 | "Make up your mind! Are you here on business or on holiday?" |
| 503  | (not in SCX) | "That guard was serious when she told you not to leave!" |
| 504  | AIRPORT s325 | "Next time, make sure you take the right bag!" |
| 505  | (not in SCX) | "You should be more careful when you enter someone else's room." |
| 506  | (not in SCX) | "You were lucky once, but never push your luck!" |
| 507  | WARD | "Did you think that killing him was a good idea?" |
| 508  | (not in SCX) | "That parrot has the biggest mouth in town." |
| 509  | BUTCHER s1405 | "Just like you thought, you're in deep trouble now." |
| 510  | (not in SCX) | "Sometimes, good guys finish last." |
| 511  | BEAR, CAVEMAN, MONKEY, ZOOBACK, ZOOFRONT, LIONCAGE, STBUTCHE | "Next time, make sure to read the signs." |
| 512  | STCHOCO s121 | "It isn't clever to tell a guard that you are a spy!" |
| 520  | (not in SCX) | "It was not a good idea to go back up there." |
| 521  | CONTROL | "That guard was waiting for people like you!" |
| 522  | CONTROL s160 | "Before you press the buttons, find the right order!" |
| 523  | FACTORY | "Enough is enough. You can't keep taking things that are not yours." |
| 524  | ROOM303 s121 | "You cheat! Did a friend give you that telephone number?" |
| 525  | (not in SCX) | "You cheat! Did a friend give you the code to the safe?" |
| 526  | (not in SCX) | "You cheat! Did a friend give you the code?" |

Code 500 (bankruptcy) is notably absent from any SCX `C,snArrest` command --
it is triggered by the engine itself when the P command would reduce the
balance below zero, confirming that the **engine checks balance on every P
command** and triggers arrest code 500 automatically.

### Arrest Flow

1. Engine detects arrest condition (bankruptcy, wrong action, etc.)
2. `C,snArrest,CODE` changes scene to ARREST.SCX
3. ARREST.SCX plays police arrest animation
4. Transitions to PRISON.SCX (`C,snPrison,0`)
5. PRISON.SCX shows reason text (section CODE) and digging animation
6. Game returns to a restart point

## Panel Display Resources (PANEL.NDX / PANEL.DAT)

The Palmettoes display uses these resources from PANEL.DAT:

| Resource     | Type     | Dimensions | Purpose |
|-------------|----------|------------|---------|
| METER       | graphics | 320x20 px  | Full meter bar graphic (background) |
| MONEYBOX    | graphics | 68x16 px   | Container/frame for the digit display |
| MONEY1      | graphics | 24x14 px   | Digit sprite set 1 (ones place) |
| MONEY2      | graphics | 24x14 px   | Digit sprite set 2 (tens place) |
| MONEY3      | graphics | 24x14 px   | Digit sprite set 3 (hundreds place) |
| MONEY4      | graphics | 24x14 px   | Digit sprite set 4 (fourth digit or sign) |
| SUSPICIONUP | sound    | 40890 bytes| Sound effect played when suspicion increases |

### Meter Initialization

The `V,Meter,1` command in AIRPORT.SCX section 110 (the game's first
interactive section) enables the `Meter` UI element in the panel.
This is the only `V,Meter` command in the entire game.

### Meter State in Saves

The save samples show the `Meter` object at **180/200** in all bundled early
game saves, including saves with both **75** and **105** Palmettoes. That means
the saved meter value is **not** a direct encoding of the current money total.

Internal naming evidence: the decrypted executable contains the string
`SuspicionMet_` followed by `er` and `Bar`, strongly suggesting an internal
label of **`SuspicionMeter`** plus a related **`Bar`** display object.

### Meter +35/+41 Fields — Y-Position, Not Value

**CRITICAL FINDING from runtime testing:** The Meter record's +35 and +41
fields are **Y-pixel coordinates** for the UI widget, not gameplay values.
All saves (including saves made mid-game in Factory, LiftRoom, Corridor,
Room302, Room303, and various street scenes) have Meter +35=180, +41=200
unchanged. Patching +35 to a low value (e.g. 10) moves the entire panel
display near the top of the screen; patching to 0 makes it disappear.

**Red bar confirmation:** With +35 patched to a low value (e.g. 100), a
red/maroon bar is visible below the displaced panel in some scenes (StChoco)
but black in others (Airport). This is the **scene background** bleeding
through, not a meter indicator — the color depends entirely on the scene's
background palette.

The suspicion system may be entirely runtime (never persisted to save files),
or it may use a different mechanism than the Meter record's +35 field.

### Suspicion / Arrest System

The game punishes wrong actions through **immediate arrest** via SCX
`C,snArrest,CODE` commands, not through a gradual meter. Runtime testing
confirmed that lock-picking (Room 301/302), stealing items (glue, coupon),
entering restricted rooms, and talking to factory workers all leave the
Meter field unchanged at 180.

**Arrest triggers are flag-gated:** For example, Factory section 250
(`1651,1,X`) arrests on touch if flag 1651 (hammer used) is set — the
factory must be visited BEFORE using the hammer at LiftRoom.

**Consistency checks:** The game cross-references answers between scenes.
Telling the StChoco guard "I'm on holiday" when flag 1017 is NOT set
(meaning you told the passport officer something different) triggers a
rejection ("That's not what you told the passport officer").

The engine-side suspicion handler at `0x402B` and the SUSPICIONUP sound
exist in the code, but may only activate in very specific late-game
conditions not yet reached in testing, or may be unused/vestigial.

**Architecture:**

| Component | Address/Location | Role |
|-----------|-----------------|------|
| Meter object | `[0x2FF6]` | Persistent state: value (180), max (200), flags |
| Meter+0x3A bit 0 | flag on Meter object | "Suspicion enabled" — must be set for system to activate |
| scene_mgr+0x3C bit 9 | `[0x30A8]+0x3C & 0x200` | "Suspicion scene" — marks scenes where suspicion can trigger |
| Suspicion check | vtable+0x38 on handler | Returns non-zero when player action is "suspicious" |
| Suspicion handler | `0x402B` | Processes suspicion event, increments meter |
| Update call | `[0x361E]` via b1 2c | Receives `push 1, push 0x708` (increment by 1, param 1800) |
| Sound param | `[0x3564]` | Variable set to 2, 5, 6, or 20 in different contexts |
| Sound player | `0x0BCE:0x43F2` | Called with `[0x3564]` to play panel sounds |

**Trigger flow:**

1. A function at ~`0x3F0E` is called during interactive scene processing
2. It calls vtable+0x38 on the current object to check if the action is suspicious
3. **If NOT suspicious** and Meter+0x3A bit 0 set: calls `0xBCE:0x43F2` with
   `[0x3564]` (likely plays a sound or updates display normally)
4. **If suspicious** and Meter+0x3A bit 0 set: calls the suspicion handler at
   `0x402B`

**Suspicion handler (`0x402B`) internals:**

1. Calls self.vtable+0x34 (preparation/state check)
2. Calls external function on self+0x5D (b1 1c stub, target 0x3E69)
3. Loads scene_mgr at `[0x30A8]` and checks `+0x3C & 0x200` (bit 9)
4. **If scene bit 9 set** (suspicion-capable scene):
   - `push 1, push 0x708` → calls method on `[0x361E]` via b1 2c external call
   - This is the actual suspicion increment (1 unit, with parameter 1800)
   - Tests return value; signals child objects at self+0x75 and self+0x59
5. **If scene bit 9 NOT set**: calls only self+0x59 (no increment)

**What `[0x361E]` is:**

Global `[0x361E]` is a **dialog/state controller object** used by 15 call sites
across the codebase. It handles dialog progression, option masking, the `+10`
quiz reward flow, the `-5` dictionary charge, and the suspicion meter update.
Four of its 15 call sites use the rare `b1 2c` external call type; the
suspicion handler at `0x402B` is one of them.

**What the suspicion check (vtable+0x38) evaluates:**

The exact conditions are inside an overlay-dispatched method (not statically
resolvable). Based on game context, likely triggers include:
- Being in a restricted area (CONTROL, FACTORY, ROOM303)
- Performing spy-related actions in guarded scenes
- Possibly wrong answers to certain NPCs

**Arrest connection:**

When the meter value drops to 0 (or reaches a threshold), the engine likely
triggers `C,snArrest,CODE` with one of the spy/guard arrest codes (503, 505,
506, 508, 510, 520, 521). These are the arrest codes with no SCX-side
`C,snArrest` trigger — they are purely engine-driven.

**Save-file evidence (negative confirmation):**

All bundled saves show Meter at 180/200 unchanged, confirming that:
- The Meter is NOT affected by Palmettoes transactions (quiz rewards, purchases)
- Early-game saves (Airport through StripAir) don't trigger suspicion events
- Suspicion is a later-game mechanic tied to spy-mission scenes

The save diffs between `3.GAM` (75 Palmettoes) and `4.GAM` (105 Palmettoes)
change the Money object and quiz flags but leave the Meter untouched. This
cleanly separates the two systems.

### Display Layout

The MONEYBOX (68x16) holds 3-4 MONEY digit sprites (each 24x14). With
24px per digit in a 68px box, up to 2-3 digits fit side by side, suggesting
the display shows values up to at most 999 (three digits). MONEY1-4 likely
represent the digit glyphs for each display position.

The METER graphic (320x20) spans a significant width -- likely the full
green bar at the bottom panel, serving as the background for the score area.

## Supermarket Price Labels (Flavor Text)

SUPER.SCX contains price labels for items in the supermarket, displayed as
look-at text. These are NOT directly linked to P commands (only the checkout
total of -275 is charged). They exist for English vocabulary practice:

| Item | Price (Palmettoes) |
|------|-------------------|
| Lollipop | 3 |
| Chewing gum | 13 |
| Bag of sweets | 19 |
| Chocolate bar | 28 |
| Box of tissues | 31 |
| Carton of milk | 38 |
| Paper towels | 39 |
| Packet of butter | 40 |
| Chocolate milk | 45 |
| Toilet paper | 48 |
| Roll of wrapping paper | 52 |
| Can of carrots | 67 |
| Can of tomatoes | 72 |
| Kilo of cheese | 78 |
| Can of corn | 82 |
| Can of olives | 91 |
| Can of peas | 93 |
| Carton of eggs | 103 |

The total of the labeled items is 922 Palmettoes -- far more than anyone
could afford. The actual checkout charges a flat 275, regardless of which
items the old lady selects.

## Key Findings

1. **No positive P commands exist anywhere in the game data.** Positive rewards
   are implemented entirely in engine-side dialog logic.

2. **The full penalty set is intentionally much larger than the starting funds.**
   However, the critical path only requires about 225 Palmettoes of spending,
   and the game provides many dialog-based reward opportunities to cover that gap.

3. **Bankruptcy triggers automatic arrest.** The engine checks balance on
   every P command and transitions to arrest code 500 without any explicit
   SCX trigger.

4. **The supermarket is the single largest expense** at 275 Palmettoes
   (49% of all penalties), making it a dramatic mid-game money gate.

5. **The exact reward policy is still an engine-level gap.** The repo now has
   strong evidence that rewards are tied to dialog completion broadly, not just
   to the 15 `Y` handlers in `GLOBAL.SCX`, but the exact one-time vs repeatable
   behavior still needs binary tracing.
