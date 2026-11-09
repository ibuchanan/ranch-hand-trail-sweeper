# Skill specification example-skill

Write the spec before the skill, and revise it when the skill changes.
Replace each prompt below with the decision it asks for.

## Objective

What does this skill help the user do?
State the outcome, not the mechanism.

## Audience

Who invokes this skill, and what do they already know?

### Style & tone

How should the skill speak and structure its answers?

## Context

When does the user reach for this skill, and what situation are they in?

### Trigger & non-trigger contexts

List requests that should trigger the skill.
List near-miss requests that should not, and where they should go instead.

### Boundaries & safety

What must the skill never do?
What needs the user's explicit approval first?

## Inputs & outputs

**Inputs**: what the skill reads or asks for.

**Outputs**: what the skill produces, and in what form.

### Evaluation plan

- **Behavior to distinguish**: what separates a good run from a bad one.
- **Scenario types**: the cases the eval suite must cover, including a
  near-miss and a baseline run without the skill.
- **Evidence source**: where scenarios come from.
- **Judging**: which checks are deterministic and which need a rubric.

## Open decisions

None yet.

## References

Sources that ground the skill's instructions.
