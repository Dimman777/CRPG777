# CRPG RULES PROTOTYPE
## Working Structure Split

## Locked / Most Stable

### 1. Core structure
- The game is a tactical CRPG.
- Combat is grid based.
- The stat hierarchy is Domain -> Group -> Stat.
- Total stat structure is 3 Domains, 9 Groups, 27 Stats.

### 2. Domains and groups
**BODY**
- **Vigour:** Power, Strength, Endurance
- **Dexterity:** Balance, Coordination, Precision
- **Stock:** Build, Vitality, Fitness

**MIND**
- **Perception:** Alertness, Observation, Intuition
- **Lore:** Learning, Memory, Knowledge
- **Intellect:** Wit, Control, Expression

**SOUL**
- **Eija:** Channel, Project, Source
- **Integrity:** Courage, Composure, Identity
- **Ardour:** Passion, Empathy, Aura

### 3. Stat scale
- Current stat scale is 1-40.
- Large monsters will use special layered rules rather than forcing all scale into the normal stat range.

### 4. Resolution concept
- Active opposition can be roll vs roll.
- Passive opposition can be roll vs DC.
- Skill output can be split into multiple actions.

### 5. Initiative / turn flow
- Initiative is rerolled after each turn.
- Characters are reinserted into initiative order after acting.
- Faster characters may act multiple times before slower ones.

### 6. Character identity model
Character creation uses:
- Background Identity: who the character was
- Aspiration: who the character wants to become
- Starting Learned Skills: what they know so far

### 7. Skill philosophy
- Skills are separate from stats.
- Stats are aptitude/capability.
- Skills are learned technique.
- Skills should avoid duplicating stats.
- Skills are likely to use broad trunks with specific branch techniques.

### 8. Technique progression
The same progression model should apply to:
- martial techniques
- magical techniques
- manuals
- grimoires
- other structured learned methods

Technique lifecycle:
- Unknown
- Exposed
- Learned
- Practiced
- Internalized

### 9. Mental progression roles
- Learning = acquisition speed
- Memory = active complexity tolerance
- Knowledge = internalization
- Focus = immediate mental consumable for execution

### 10. Opening cost model
- Non-internalized techniques do not need manual pre-loading.
- First use in an encounter has a Focus Opening Cost.
- Later uses have a lower Use Cost.
- Internalization reduces or removes those burdens.

### 11. Core consumables
Early prototype core set:
- Injury
- Sickness
- Muscle Fatigue
- Cardio Fatigue
- Focus
- Eija

### 12. Standard consumable derivation
Most consumables use:

`Max = Primary + Secondary + (Support / 2)`

### 13. Consumable formulas
- Injury = Vitality + Build + Endurance/2
- Sickness = Vitality + Endurance + Fitness/2
- Muscle Fatigue = Strength + Endurance + Fitness/2
- Cardio Fatigue = Fitness + Endurance + Build/2
- Focus = Control + Memory + Composure/2

### 14. Eija model
- Eija Max = Source x 3
- Source = stored reserve
- Channel = draw, movement, and routing of Eija
- Project = per-turn conversion of Eija into effect

### 15. Overcasting
- Overcasting exceeds normal Channel or Project limits.
- Overcasting spills into Cardio Fatigue first.
- If necessary it spills into Injury.

### 16. Eija items
Magical items may enhance:
- Source
- Channel
- Project

This is preferred over generic mana or spell-power bonuses.

### 17. Grimoires and manuals
- Grimoires and manuals are persistent learning assets.
- Possession does not equal understanding.
- Books support exposure, acquisition, study, and internalization.

## Provisional / Current Lean

### 1. Dice language
- The prototype still uses dice language internally.
- The final CRPG UI may show talent bands or expected ranges instead of explicit dice.

### 2. Talent mapping
- 1-40 likely maps into 10 talent bands.
- Exact presentation is not locked.

### 3. Multi-action tradeoff
- Larger pool = stronger result potential.
- Split pool = more actions, weaker individual results.
- Minimum dice/action threshold is not finalized.

### 4. Action economy
- Heavy actions likely delay the next turn more than light actions.
- Some augmentations may trade tempo for power.
- Some may trade Focus for control, speed, or precision.

### 5. Composite actions
- Base actions may be augmented with contributions from other traits or mechanics.
- Example direction: Power augmentation vs Coordination augmentation.

### 6. Resource degradation
- Visible degradation is likely:
  Fresh -> Worn -> Strained -> Exhausted -> Critical -> Collapse
- There may be finer hidden thresholds later, but the visible model should stay readable.

### 7. Recovery ceilings
- Collapse should limit ordinary recovery to a lower tier ceiling until stronger recovery occurs.
- This is intended to preserve attrition over encounters and expeditions.

### 8. Resource recovery logic
Likely recovery influences:
- Injury recovery: Fitness
- Sickness recovery: Fitness
- Muscle/Cardio recovery: Fitness
- Focus recovery: likely Control
- Eija flow/recovery: Channel

### 9. Skill tree structure
- Broad trunk skills with branch techniques remains the strongest current direction.
- Physical, magical, and technical progressions should all fit the same general model.

### 10. Skill utility filter
- Skills should justify themselves through recurring use in combat, exploration, dialogue, economy, or environmental interaction.
- Weak trades are still better as identities/backgrounds than as dead active skills.

### 11. Starting stat generation
- The final method is unresolved, but specialization pressure is required.
- Creation should make Domain -> Group -> Stat priority matter.
- Starting characters should feel shaped rather than flat.

### 12. Large monsters
- They will likely use special rules for size, reach, footprint, force, resistance, and wound logic.
- Exact monster scaling rules are still open.

### 13. Eija environment interaction
- Channel should matter for drawing from surroundings, not just refill in a vacuum.
- Some casters may rely more on ambient Eija than large personal Source.

### 14. Magical gear identity
- Source items support depth/reserve.
- Channel items support throughput/routing.
- Project items support burst/output/shaping ceiling.

## Open Questions

### 1. Resolution details
- What is the exact final action resolution formula?
- How much of the dice model remains visible to the player in the CRPG?

### 2. Initiative
- What exact stats govern initiative?
- How are action time costs applied numerically?
- How does movement affect turn delay?

### 3. Combat defense and damage
- What is the defense model?
- How is damage resolved?
- How do armor, guard, evasion, and resistance interact?

### 4. Multi-action floor
- Is there a minimum dice requirement per action?
- Can every skill pool always be split freely?

### 5. Starting stat generation
- What exact generation method is used?
- How are Background and Aspiration mods applied?
- What is the starting cap?

### 6. Talent presentation
- What do the 10 talent bands mean in player-facing terms?
- Are they named, numeric, descriptive, or hidden?

### 7. Resource penalties
- What exact penalties apply at each degradation tier?
- Are penalties numeric, qualitative, or both?

### 8. Recovery timing
- What counts as turn recovery, short rest, camp rest, treatment, or meditation?
- Which pools recover in combat, out of combat, or only in structured recovery?

### 9. Skill list
- What exact skill trunks exist?
- Which branches belong under each trunk?
- Which skills are frequent enough to justify implementation?

### 10. Progression costs
- How are techniques learned?
- What exactly advances Learning progress, Practiced state, and Internalization?
- Are there point costs, use-based growth, study requirements, or all three?

### 11. Book systems
- How are manuals and grimoires stored?
- How long does Decipher / Extract / Study / Assimilate take?
- What gates exist for difficult texts?

### 12. Aspiration system
- How exactly does Aspiration influence events, opportunities, progression, or story weighting?

### 13. Large monster special rules
- How do size and mass alter forced movement, space control, wounds, and action economy?
- What remains shared with humanoid combat rules?

### 14. Eija fine rules
- Exact per-turn effect of Channel
- Exact per-turn cap of Project
- Whether ambient draw is automatic, active, or context-based
- Whether different magic schools favor Source, Channel, or Project differently
