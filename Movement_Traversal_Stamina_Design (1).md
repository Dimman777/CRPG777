# Movement, Traversal, Stamina, and Fatigue Design Draft

Working design draft for the CRPG movement model.

This document covers:

* realtime and danger-mode movement logic
* separate movement and action initiative tracks
* sprint momentum rules
* contextual jump and climb resolution
* grounded vertical traversal at 1m tiles / 0.5m height increments
* sample cardio and muscle-fatigue costs for movement and terrain

This is a preliminary implementation document, not final rules text.

\---

## 1\. Core Design Goals

The movement system should feel:

* grounded rather than superheroic
* readable on a 1m tile grid
* compatible with both realtime exploration and turn-based danger/combat
* physically intuitive
* tactically rich without excessive command bloat

The major design goals are:

1. Preserve small, interruptible, initiative-driven turns rather than large action packages.
2. Separate action tempo from locomotion speed.
3. Make movement through terrain, elevation, and obstacles materially important.
4. Track both short-term exertion (**Cardio**) and local muscular wear (**Fatigue**).
5. Keep player commands simple while resolving traversal contextually.

\---

## 2\. Core Movement Model

### 2.1 Two Parallel Recovery Tracks

The system uses two recovery tracks:

* **Action Recovery**: attacks, spells, item use, shoves, grapples, door opening under pressure, etc.
* **Movement Recovery**: steps, repositioning, running, sprinting, jumps, climbs, vaults, pulls-up, etc.

This avoids the problem where one initiative value governs all of the following at once:

* attack rate
* casting speed
* movement range
* reaction frequency
* interruption timing

Instead:

* **Action tempo** controls how often a character can do something decisive.
* **Movement tempo** controls how often a character can reposition their body.

A character may therefore get:

* a movement opportunity before their next attack opportunity
* several action opportunities over time without being the fastest runner
* better movement throughput without also becoming the fastest attacker/caster

### 2.2 Tile and Elevation Scale

The system assumes:

* **1 meter square tiles**
* **0.5 meter vertical increments**

That scale supports grounded traversal and prevents exaggerated leap distances.

\---

## 3\. Resource Model: Cardio and Fatigue

The system tracks two physical exertion resources.

### 3.1 Cardio

Cardio represents:

* breathlessness
* heart rate strain
* short-term oxygen demand
* the cost of repeated high-output movement

Cardio rises quickly from:

* sprinting
* repeated jumping
* climbing
* running uphill
* fighting while moving hard

Cardio recovers relatively quickly when slowing down, stopping, or resting.

### 3.2 Fatigue

Fatigue represents:

* local muscle strain
* leg burn
* arm strain
* posture wear
* cumulative bodily stress

Fatigue rises from:

* climbing
* vaulting heavy obstacles
* crouch-walking
* carrying load
* bracing against terrain
* repeated explosive movement

Fatigue recovers more slowly than Cardio.

### 3.3 Design Distinction

A character can be:

* high Cardio, low Fatigue: winded but not yet badly worn down
* low Cardio, high Fatigue: not gasping, but legs/arms are burning and movement control worsens
* high in both: seriously degraded

\---

## 4\. Player-Facing Movement Commands

The player-facing command set should remain small.

### 4.1 Primary Commands

* **Move**
* **Run**
* **Sprint**
* **Stop**
* **Jump**
* **Climb**
* **Crouch**
* **Drop** (optional but recommended)

### 4.2 Contextual Resolution

The player chooses an intent command, then clicks a target tile, edge, obstacle, or object.

The engine resolves the exact sub-action contextually.

Examples:

**Jump + click** may resolve to:

* hop over
* vault over
* hurdle
* jump onto
* jump gap
* jump to grab

**Climb + click** may resolve to:

* mantle up
* climb over
* pull up
* climb vertically
* climb from hanging state

This avoids excessive command sprawl while preserving physically distinct outcomes.

### 4.3 Auto-Resolved Trivial Traversal

**Move** and **Run** should automatically handle trivial terrain transitions where failure is unlikely and player intent is obvious.

Examples:

* stepping up 0.5m
* stepping down 0.5m
* crossing small clutter
* minor level changes

Nontrivial traversal should require explicit **Jump** or **Climb**, especially in Danger mode.

\---

## 5\. Movement States

### 5.1 Move

A controlled baseline pace.

Use for:

* ordinary navigation
* precise positioning
* cautious approach
* most exploration traversal

Traits:

* low Cardio cost
* low Fatigue cost
* best control
* best path fidelity

### 5.2 Run

A faster locomotion mode without full momentum commitment.

Use for:

* covering ground quickly
* clearing moderate obstacles in motion
* combat repositioning

Traits:

* moderate Cardio cost
* moderate Fatigue cost
* reduced fine control compared to Move
* improves hurdle/vault potential

### 5.3 Sprint

Sprint is a **momentum state**, not merely a larger move.

When a character uses Sprint:

* they move farther/faster immediately
* they enter **Sprinting**
* future movement opportunities must be **Sprint** again or **Stop**

This means Sprint trades flexibility for momentum.

### 5.4 Stop

Stop ends the Sprinting state.

It represents:

* arresting momentum
* regaining full movement control
* transitioning back to Move/Run options

### 5.5 Crouch

Crouch is a low-profile locomotion state used for:

* stealth
* low cover movement
* passing under obstacles
* reducing silhouette

Traits:

* low Cardio cost
* moderate Fatigue cost, especially legs and hips
* slower pace
* better concealment

\---

## 6\. Sprint Momentum Rules

### 6.1 Core Rule

**Sprint** moves the character **2 tiles** and places them in the **Sprinting** state.

While Sprinting:

* the next movement opportunity must be either **Sprint** or **Stop**
* ordinary Move/Run/Shift/Withdraw style movement is unavailable until Sprinting ends
* turning is limited
* precision actions are degraded

### 6.2 Benefits of Sprinting

* rapid gap-closing
* rapid escape
* momentum for jump, vault, and shove actions
* increased horizontal reach
* stronger charge-like interactions

### 6.3 Costs of Sprinting

* reduced flexibility
* limited turning
* higher Cardio accumulation
* higher exposure
* weaker precision attacks and spellcasting during or immediately after Sprinting

### 6.4 Suggested Turning Rule

While Sprinting:

* continuing straight is free
* shallow directional change is allowed
* sharp directional change requires **Stop** or causes a penalty

Exact angle limits can be tuned later based on grid facing rules.

\---

## 7\. Jump and Climb as Contextual Intents

### 7.1 Jump

Jump means:

> The character attempts to leave the ground in order to clear, mount, cross, or grab.

Possible contextual results:

* hop over obstacle
* vault over obstacle
* hurdle while running
* jump onto object
* jump across gap
* jump to grab ledge/handhold

### 7.2 Climb

Climb means:

> The character attempts to use leverage, contact, and body control to go up, over, or onto a structure.

Possible contextual results:

* mantle onto ledge
* climb over chest-high barrier
* pull up from hanging state
* vertical climb on climbable surface
* scramble up rough object

### 7.3 Why This Is Better Than Many Separate Verbs

The player should think:

* “I want to get over that wall.”

The player should not need to think:

* “Is this a hurdle, vault, mantle, or climb-over input?”

The engine resolves that from:

* obstacle height
* obstacle depth
* movement state
* edge quality
* target surface width
* landing space
* stats
* load

\---

## 8\. Elevation Transitions and Grounded Vertical Traversal

This system should avoid exaggerated cinematic jumps.

At 1m tiles and 0.5m height increments, vertical traversal should feel human-scaled. The map does not use true inclines. Instead, rising or falling ground is represented by discrete elevation changes between adjacent tiles.

### 8.1 Elevation Transition Model

Each move across the grid evaluates two things:

* the **surface type** of the destination tile
* the **elevation transition** between the current tile and the destination tile

Use these transition classes:

* **0m**: level transition
* **+0.5m**: gentle rise / step-up
* **-0.5m**: gentle drop / step-down
* **+1.0m**: steep rise / big step / mount
* **-1.0m**: steep drop / hop-down / controlled descent

This means a gradual ascent is modeled as repeated **0.5m rises**, while a steep ascent is modeled as **1.0m rises**. Costs are applied at the tile edge, not through an incline-angle simulation.

### 8.2 Design Boundary

Use these broad rules:

* **0.5m up/down** = movement modifier
* **1.0m up/down** = movement-plus-traversal event
* **1.5m+** = explicit Jump / Climb / Drop / Grab territory



### 8.3 0.5m Rise

Interpretation:

* step height
* minor scramble
* trivial mount for able-bodied characters

Typical use:

* walking up a low step
* running over slight elevation change
* stepping onto low rocks or curbs

Usually handled automatically by Move/Run.

### 8.4 1.0m Rise

Interpretation:

* mount height
* big step while walking
* vault/hurdle candidate while running
* easy jump-onto for fit characters from standing

Typical use:

* crates
* low carts
* tables
* low walls

### 8.5 1.5m Rise

Interpretation:

* athletic height
* awkward climb-hop while walking
* true athletic hurdle/vault while running
* athletic jump-onto from standing
* good jump-to-grab height

Typical use:

* chest-high barriers
* rough walls
* stacked objects

### 8.6 2.0m Rise

Interpretation:

* climb height
* generally no clean routine jump-onto
* usually requires jump-to-grab and pull-up/mantle

Typical use:

* wall lips
* broken balcony edges
* ledges

### 8.7 3.0m Handhold

Interpretation:

* athletic jump-to-grab only
* not a jump-onto height
* usually requires a good run-up or high athletic ability

Typical use:

* overhead ledges
* branches
* bars
* damaged stone lips

### 8.8 Important Distinction

The following are not the same:

* height that can be **vaulted over**
* height that can be **jumped onto**
* height that can be **jumped to grab**

This distinction is essential to keeping traversal grounded.

\---

## 9\. Traversal Categories

### 9.1 Step

A simple elevation transition without major aerial commitment.

Typical use:

* 0.5m up/down
* small uneven terrain

### 9.2 Vault / Hurdle

Clear or pass over an obstacle without stopping to climb.

Typical use:

* 1.0m barrier while running
* 1.5m barrier for athletic characters

### 9.3 Jump Onto

Leave the ground and land on top of a raised surface.

Typical use:

* carts
* broad crates
* tables
* rocks

### 9.4 Jump to Grab

Leave the ground and catch an edge, branch, sill, or handhold.

Typical use:

* ledge access
* starting a climb
* catching elevated structures

### 9.5 Mantle / Pull-Up

Use leverage to bring the body fully onto a ledge or object after a grab or supported climb.

### 9.6 Vertical Climb

Used for ladders, rough walls, roots, climbable structures, and explicit climbing paths.

\---

## 10\. Sprint and Jump Interaction

### 10.1 Sprint-Enhanced Jump

Jumping while Sprinting should be enhanced by momentum.

Effects:

* greater horizontal reach
* better obstacle clearance
* better jump-to-grab reach
* stronger vault/hurdle performance

Costs:

* worse precision
* worse landing control
* limited ability to stop cleanly after landing
* usually remains in Sprinting state unless explicitly Stopped

### 10.2 Delayed Takeoff During Sprint

A sprinting jump may launch from:

* the first tile of the sprint path
* the second tile of the sprint path

**Coordination** improves delayed takeoff control.

This means:

* low Coordination characters prefer early takeoff
* high Coordination characters can more reliably delay to the second tile
* the second tile may grant greater distance or better clearance due to fuller momentum

This should be treated as **control over takeoff timing**, not just blind randomness.

\---

## 11\. Suggested Stat Responsibilities

These use current draft stat logic and can be tuned later.

### 11.1 Movement Tempo

Primarily influenced by:

* Fitness
* Balance
* Build/load interaction
* Cardio state
* Fatigue state

### 11.2 Action Tempo

Primarily influenced by:

* Alertness
* Wit
* Coordination
* current stance
* fatigue/cardio penalties

### 11.3 Jump Onto

* Power / Fitness: lift and propulsion
* Coordination: launch timing
* Balance: landing control

### 11.4 Jump to Grab

* Coordination: reach timing and hand placement
* Power / Strength: upward body drive
* possibly Precision: narrow or awkward target catch

### 11.5 Vault / Hurdle

* Coordination
* Balance
* movement momentum
* Fitness / Power for harder obstacles

### 11.6 Climb / Pull-Up / Mantle

* Strength / Power
* Fitness
* Endurance for repeated pulls or hanging states
* Balance/Coordination for awkward surfaces

\---

## 12\. Real-Time vs Danger Mode

### 12.1 Realtime Exploration

In realtime:

* movement is continuous or loosely sampled
* trivial traversal auto-resolves
* Cardio and Fatigue update in the background
* pathing is more forgiving
* Jump and Climb are used mostly for meaningful traversal choices

### 12.2 Danger / Conflict Mode

In danger mode:

* movement opportunities become explicit
* action opportunities become explicit
* costs become sharper
* interruption windows matter
* failure and exposure matter
* Jump and Climb require deliberate intent input for nontrivial traversal

This preserves one movement language across modes rather than creating two separate games.

\---

## 13\. Example Cost Scale

The exact numbers will need tuning. For now use an intentionally simple draft scale.

### 13.1 Draft Units

Track both Cardio and Fatigue on a small integer scale.

Suggested broad interpretation per encounter segment:

* **0-5**: negligible
* **6-15**: noticeable
* **16-30**: meaningful strain
* **31-50**: severe
* **50+**: extreme / performance breakdown risk

These are sample tuning values, not final balance.

\---

## 14\. Base Movement Costs by Movement Type

These costs assume:

* level ground
* no load penalty
* ordinary footing
* per **1 tile** unless otherwise stated

|Movement Type|Distance|Cardio|Fatigue|Notes|
|-|-:|-:|-:|-|
|Move|1 tile|1|0|baseline controlled movement|
|Run|1 tile|2|1|faster travel without full commitment|
|Sprint|2 tiles|4|1|enters or continues Sprinting|
|Stop|0-1 tile|1|1|ends Sprinting; regains control|
|Crouch Move|1 tile|1|2|low cardio, more local muscle strain|
|Crawl|1 tile|2|3|slow and physically taxing|
|Backstep / cautious retreat|1 tile|2|1|under pressure|

### Notes

* Sprint is intentionally more Cardio-heavy than Fatigue-heavy in the short term.
* Crouch and Crawl produce more localized strain than open running.
* Longer sustained movement sequences will create larger cumulative Fatigue than these single-step samples imply.

\---

## 15\. Terrain Modifiers and Elevation Transitions

Add these to base movement costs. Terrain and elevation should usually stack.

### 15.1 Flat Firm Ground

|Terrain|Cardio Mod|Fatigue Mod|Notes|
|-|-:|-:|-|
|Road / packed earth|0|0|baseline|
|Stone floor|0|0|baseline indoors|
|Dry grass / field|0|0|baseline open ground|

### 15.2 Soft or Uneven Ground

|Terrain|Cardio Mod|Fatigue Mod|Notes|
|-|-:|-:|-|
|Loose dirt|+0|+1|mild leg strain|
|Shallow mud|+1|+1|drag and instability|
|Deep mud|+2|+2|severe drag|
|Sand|+1|+2|high calf and ankle fatigue|
|Scree / loose rock|+1|+2|footing strain|
|Dense roots|+1|+1|trip and foot placement difficulty|
|Rubble|+1|+2|awkward steps|

### 15.3 Elevation Transition Modifiers

Apply these on top of terrain whenever movement crosses a tile edge with a height difference.

|Elevation Transition|Cardio Mod|Fatigue Mod|Notes|
|-|-:|-:|-|
|Level (0m)|+0|+0|no additional elevation cost|
|Rise +0.5m|+1|+0|gentle rise; equivalent to a mild uphill step|
|Drop -0.5m|+0|+1|controlled descent and braking strain|
|Rise +1.0m|+2|+1|steep rise; big step, mount, or scramble|
|Drop -1.0m|+0|+2|steep drop; hop-down or controlled descent|

Notes:

* Repeated **+0.5m rises** model a gradual uphill route.
* Repeated **+1.0m rises** model a steep broken ascent.
* In bad terrain, a **+1.0m** rise may become explicit traversal rather than ordinary movement.
* Descents are usually less Cardio-heavy than rises, but often generate more localized leg Fatigue from braking and balance correction.

### 15.4 Water and Wet Surfaces

|Terrain|Cardio Mod|Fatigue Mod|Notes|
|-|-:|-:|-|
|Wet stone|+0|+1|careful footing|
|Shin-deep water|+1|+1|resistance|
|Knee-deep water|+2|+2|major movement drag|
|Waist-deep water|+3|+2|movement heavily constrained|

\---

## 16\. Obstacle Traversal Sample Costs

These are in addition to approach movement.

### 16.1 Step / Minor Rise

|Traversal|Typical Height|Cardio|Fatigue|Notes|
|-|-:|-:|-:|-|
|Step Up|0.5m|0|1|usually auto-resolved|
|Step Down|0.5m|0|1|controlled descent|

### 16.2 Vault / Hurdle

|Traversal|Typical Height|Cardio|Fatigue|Notes|
|-|-:|-:|-:|-|
|Walk Vault|1.0m|1|2|controlled but awkward|
|Run Vault|1.0m|2|2|smoother, faster|
|Athletic Hurdle|1.5m|3|3|requires strong stats or momentum|
|Sprint Vault|1.0-1.5m|3|2|strong momentum, less control|

### 16.3 Jump Onto

|Traversal|Height|Cardio|Fatigue|Notes|
|-|-:|-:|-:|-|
|Jump Onto Low Platform|1.0m|2|2|broad target assumed|
|Athletic Jump Onto|1.5m|4|4|not routine|
|Sprint Jump Onto|1.0-1.5m|4|3|more reach, worse landing control|

### 16.4 Jump to Grab

|Traversal|Height|Cardio|Fatigue|Notes|
|-|-:|-:|-:|-|
|Jump to Grab Low Ledge|1.5m|2|2|common athletic action|
|Jump to Grab Climb Ledge|2.0m|3|3|likely follow-up mantle required|
|Athletic Jump to Grab High Handhold|3.0m|5|4|requires very good timing/ability|
|Sprint Jump to Grab|+0.5 to +1m effective reach|+1|+1|add to base grab cost|

### 16.5 Pull-Up / Mantle / Climb Onto

|Traversal|Situation|Cardio|Fatigue|Notes|
|-|-|-:|-:|-|
|Mantle from good ledge|after grab|2|3|common climb finish|
|Pull-Up onto high ledge|after 2m grab|3|4|upper body heavy|
|Awkward Climb Onto|rough edge / bad footing|3|5|unstable and strenuous|
|Hanging recovery adjustment|while dangling|1|2|reposition hands/body|

\---

## 17\. Climbing Sample Costs by Surface

Costs are per **1 vertical step of 0.5m** unless otherwise noted.

|Surface Type|Cardio|Fatigue|Notes|
|-|-:|-:|-|
|Ladder|1|1|efficient ascent|
|Stairs / rough stepped ruin|1|1|walking, not true climbing|
|Easy climb surface with handholds|2|2|wall roots, broken stone|
|Moderate climb surface|3|3|uneven but workable|
|Difficult climb surface|4|4|sparse holds, serious effort|
|Hanging traverse|3|4|arm-heavy|
|Overhang / partial overhang|5|5|exceptional effort|

Additional modifiers:

* Heavy load: +1 to +3 Fatigue depending on load class
* Wet/slippery: +1 Fatigue, sometimes +1 Cardio from slower controlled effort
* Under pressure/in combat: +1 Cardio from panic/output spike

\---

## 18\. Terrain + Movement Examples

### Example A: Running across road

* Run 3 tiles on road
* Base cost: 3 x (Cardio 2, Fatigue 1)
* Total: **Cardio 6, Fatigue 3**

### Example B: Sprint through shallow mud

* Sprint 2 tiles through shallow mud
* Base Sprint: Cardio 4, Fatigue 1
* Mud mod per tile: +1 Cardio, +1 Fatigue
* Total for 2 sprint tiles: **Cardio 6, Fatigue 3**

### Example C: Crouch through rubble

* Crouch Move 2 tiles through rubble
* Base per tile: Cardio 1, Fatigue 2
* Rubble mod per tile: +1 Cardio, +2 Fatigue
* Total: **Cardio 4, Fatigue 8**

This demonstrates how crouch can be low-breath but high-muscle strain.

### Example D: Sprint + jump to grab 2m ledge

* Sprint: Cardio 4, Fatigue 1
* Jump to Grab 2m: Cardio 3, Fatigue 3
* Sprint grab modifier: +1 Cardio, +1 Fatigue
* Total: **Cardio 8, Fatigue 5**

### Example E: Walk to wall, jump to grab, mantle up

* Move 1 tile: Cardio 1, Fatigue 0
* Jump to Grab 1.5m: Cardio 2, Fatigue 2
* Mantle: Cardio 2, Fatigue 3
* Total: **Cardio 5, Fatigue 5**

### Example F: Climb 2m rough wall from hanging state

Assume 4 x 0.5m increments on moderate climb surface:

* Climb per increment: Cardio 3, Fatigue 3
* 4 increments total: **Cardio 12, Fatigue 12**

This is meaningfully strenuous and should feel costly in danger mode.

\---

## 19\. Load and Armor Modifiers

These values are provisional.

### 19.1 Load Classes

|Load Class|Cardio Mod|Fatigue Mod|Notes|
|-|-:|-:|-|
|Light|0|0|no major penalty|
|Moderate|+0|+1|noticeable on climbs/crouch|
|Heavy|+1|+2|large movement burden|
|Extreme|+2|+3|borderline tactical immobility|

### 19.2 Armor / Gear Interaction

Armor can apply modifiers differently depending on activity.

Examples:

* walking in mail: moderate Fatigue increase over long periods
* sprinting in heavy gear: high Cardio spike
* climbing in armor: major Fatigue increase and sometimes reduced valid traversal options

This should be resolved later in equipment rules.

\---

## 20\. Performance Effects of Cardio and Fatigue

### 20.1 Rising Cardio Should Cause

* slower movement recovery
* worse sprint continuation
* weaker spell stability under exertion
* reduced aiming precision
* increased recovery needed after high-output actions

### 20.2 Rising Fatigue Should Cause

* weaker jump lift
* worse landing control
* worse climb performance
* reduced vault quality
* poorer crouch/crawl endurance
* increased stumble/slip risk on bad terrain

### 20.3 Combined High Strain Should Cause

* reduced control over delayed sprint takeoff
* inability to continue sprint effectively
* failed pull-up attempts
* forced slowdowns
* posture breakdown and large penalties

\---

## 21\. Suggested Input and UI Behavior

### 21.1 Hover Preview

After selecting **Jump** or **Climb**, hovering a target should preview the resolved action.

Examples:

* Step Up
* Vault Over
* Jump Onto
* Jump to Grab
* Mantle Up
* Too High
* Need Sprint
* Athletic
* No Handhold

### 21.2 Cost Preview

Where useful, preview approximate costs:

* Cardio +3
* Fatigue +2
* Remains Sprinting
* Requires Pull-Up

### 21.3 Danger Mode Clarity

In danger mode, previews should also show:

* whether the traversal consumes a movement opportunity
* whether it leaves the character hanging
* whether it causes exposure or vulnerability
* whether the character can still act afterward

\---

## 22\. Implementation Notes

### 22.1 Start Simple

Initial implementation should not try to model every edge case.

A practical early version can use:

* obstacle height class
* surface width class
* handhold quality class
* terrain category
* movement state
* load class

From those values, resolve:

* valid or invalid
* traversal subtype
* Cardio cost
* Fatigue cost
* success difficulty

### 22.2 Avoid Over-Granularity

Do not surface every hidden subtype to the player as a separate command.

Keep player input simple.
Keep physical resolution rich under the hood.

### 22.3 Preserve Consistency Across Modes

Realtime and Danger mode should share the same movement logic.
The difference is:

* cost visibility
* strictness
* interruption handling
* path precision
* consequence density

\---

## 23\. Strong Provisional Summary

The current movement design is:

* use **separate movement and action recovery tracks**
* keep player-facing commands small
* make **Jump** and **Climb** contextual
* treat **Sprint** as a momentum state rather than a larger move
* keep vertical traversal grounded with strict height tiers
* treat **Cardio** and **Fatigue** as separate but interacting costs
* let terrain, load, and movement state materially change movement expense

In practical terms:

* **0.5m** is step height
* **1.0m** is mount/vault height
* **1.5m** is athletic traversal height
* **2.0m** usually requires grab + climb
* **3.0m handholds** are athletic jump-to-grab targets, not jump-onto surfaces

This gives the game a movement language that is physically legible, tactically meaningful, and consistent with a grounded CRPG rather than a superhero platformer.

