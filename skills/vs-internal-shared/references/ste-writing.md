# STE mode — controlled English for instructions and explanations

ASD-STE100 Simplified Technical English (STE) is a controlled language from
aerospace maintenance manuals. Its rules force short, literal sentences. A tired
reader or a non-native reader understands them on the first pass. The vs skills use a
softened version: about 80% of the way to the specification. Keep the rules
that make text easier to read. Drop the rules that only make sense with the
official STE dictionary.

`vs-write` owns this file. Other skills link here and run the same checker. Do
not paste these rules into another skill.

## Rules

1. **One instruction per sentence.** Write each step as its own sentence. Two
   actions done at the same time may share a sentence.
2. **Short sentences.** A procedural sentence (a step, a command, a warning)
   has at most 20 words. A descriptive sentence has at most 25 words.
3. **Imperative for instructions.** Start a step with the verb. Write "Run
   the migration", not "You will want to run the migration".
4. **Active voice.** Name the actor. Passive voice is allowed in a
   description only when the actor is unknown or does not matter.
5. **Condition first.** Put the condition before the action: "If the build
   fails, read the log." The reader must know when a step applies before
   reading the step.
6. **Warning first.** Put a warning or caution before the step it protects.
   Start it with a command: "Do not force-push to `master`."
7. **One word, one meaning.** Use one term for one thing in the whole text. Do
   not alternate between synonyms such as "build", "bundle", and "artifact" for
   the same object.
8. **Simple words.** Prefer the short common word: use, start, stop, make
   sure, before, after, about, help, show. The checker lists the words it
   rejects and their replacements.
9. **Keep the articles.** Write "Open the file", not "Open file". Telegraphic
   style removes words the reader needs.
10. **Short paragraphs.** One topic per paragraph, at most six sentences.

## What the softened mode relaxes

- **Technical names are allowed.** Project nouns, code identifiers, file
  paths, commands, API names, and product names stay exactly as they are. STE
  calls these "technical names"; they are not dictionary violations.
- **No official dictionary.** Prefer simple words, but do not reject a precise
  word only because the STE dictionary lacks it. Precision wins over the list.
- **-ing forms and phrasal verbs are allowed** when the alternative is less
  clear.
- **Full STE on request.** When the user asks for strict ASD-STE100, apply
  the rules without these relaxations and say which words have no approved
  equivalent.

Never trade a fact, a condition, or a warning for a shorter sentence. Split
the sentence instead.

## When to use it

- The user asks for STE, ASD-STE100, Simplified Technical English, controlled
  language, or "plain technical English".
- The text is procedural: steps, runbooks, test instructions, rollout or
  rollback notes, warnings, and `Your action` blocks.
- The reader is new to the topic: beginner explainers and onboarding copy.

Do not use it for code, direct quotations, legal text, or a voice the user
asked to keep.

## Check

Run the checker on the draft:

```bash
node skills/vs-write/scripts/check-ste.mjs <draft.md|artifact.html>
```

It ignores code blocks, inline code, URLs, HTML comments, tables, and markup.
For an HTMDX artifact it checks only the prose inside the source block.

- **Exit 0:** no rule failures. Warnings (possible passive voice) still need a
  look.
- **Exit 1:** a sentence is too long or uses a rejected word. Split or rewrite
  each reported sentence, then run the checker again.
- **Exit 2:** the file could not be checked. Treat this as not checked, not as
  a pass.
