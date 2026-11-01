---
title: "AI-made assets: where disclosure and licensing rules stand (October 2026)"
date: 2026-10-31
summary: "The dispute over Steam's AI disclosure, Korea's draft guideline on AI claims in advertising, the EU copyright consultation and US litigation, read from the side of people who make game assets. Commentary for keeping good records, not legal advice."
status: draft
sources:
  - title: "Steamworks Documentation — Content Survey (AI-generated content section)"
    url: "https://partner.steamgames.com/doc/gettingstarted/contentsurvey"
  - title: "GIGAZINE — Steam updates AI disclosure guidelines (2026-01-20)"
    url: "https://gigazine.net/gsc_news/en/20260120-steam-updates-ai-disclosure-guidelines"
  - title: "Notebookcheck — Epic CEO Tim Sweeney lambasts Steam AI disclosure policy (2026-10-25)"
    url: "https://www.notebookcheck.net/Epic-CEO-Tim-Sweeney-lambasts-abhorrent-Steam-AI-Disclosure-Policy-claiming-labels-double-as-political-statement.1433682.0.html"
  - title: "Law Times (Korea) — KFTC seeks comments on draft AI labeling and advertising guideline (2026-10-26)"
    url: "https://www.lawtimes.co.kr/news/articleView.html?idxno=228372"
  - title: "Shin & Kim newsletter — transparency duties under Korea's AI Basic Act (2026-02-26, Korean)"
    url: "https://shinkim.com/kor/media/newsletter/3142"
  - title: "Pinsent Masons Out-Law — EU considers copyright reform for gen-AI as US court rejects 'fair use' claim (2026-10-06)"
    url: "https://www.pinsentmasons.com/out-law/news/eu-copyright-reform--gen-ai-us-court-rejects-fair-use-claim"
  - title: "EFF — Rewriting Copyright Law for Generative AI Would Hurt Everyone (2026-10-30)"
    url: "https://www.eff.org/deeplinks/2026/10/rewriting-copyright-law-generative-ai-would-hurt-everyone"
  - title: "Black Forest Labs — FLUX 3 Image Klein: open weights, 5.6B parameters (2026-10-15)"
    url: "https://bfl.ai/blog/flux-3-image-klein"
---
This is not legal advice. From the policy and dispute news of mid-to-late October, we picked only what affects **how game developers and creators who make art or sound with AI should keep records**. The short version: no rule was settled this month, but the questions you will be asked are now fairly clear.

## 1. Steam's AI disclosure — same rules, louder dispute

**What happened.** In late October Epic Games' Tim Sweeney called Steam's AI disclosure policy "abhorrent". According to Notebookcheck's October 25 report, his point was that the label hands ammunition to people who want to attack developers. The same report says Valve has not changed its stance and still requires disclosure of AI-generated content.

The current rule lives in the Content Survey of the Steamworks documentation. The section is about **content that ships with your game and is consumed by players**; efficiency gains from development tools are not its focus. Content made with AI help during development is "Pre-Generated"; content created while the game runs is "Live-Generated", and for the latter you also have to describe the guardrails that keep it from producing illegal content. GIGAZINE reported on January 20 that development aids such as code helpers no longer need to be disclosed.

**Why it matters for game assets.** Criticism aside, the rule stands, so teams nearing release should prepare for it as written. The problem is that most teams only try to remember which assets used AI right before launch. The survey asks for a detailed description, and without records the answer gets vague.

**What to do.**
- Add an "AI use" column to your asset list (a spreadsheet is enough) with three values: *none / drafts only / included in the shipped asset*. Steam looks at content that ships to players, so this split is your answer.
- If your game generates dialogue or images with AI at runtime, document your input filters and output checks now; the survey asks about them.

## 2. Korea — a draft guideline on AI claims in ads, and the AI Basic Act

**What happened.** According to Law Times on October 26, Korea's Fair Trade Commission is taking comments from October 22 to November 11 on a draft guideline for AI-related labeling and advertising. It is not legally binding; it explains the general principles of the advertising law in an AI context. The article names three problems behind the guideline: "AI washing" (advertising AI use that does not exist), not disclosing scope, operating conditions or limits even when AI is used, and false or exaggerated ads using AI-made virtual people, reviews or deepfakes.

Separately, Article 31 of the AI Basic Act, in force since January 22, 2026, sets transparency duties. In Shin & Kim's reading, those duties fall on "AI business operators" that develop and provide AI or provide products and services using it. Generative AI output must be labeled as such, and hard-to-distinguish deepfakes must be disclosed clearly; artistic and creative works may be labeled in ways that do not hinder enjoyment. The same newsletter says people who simply use AI to make their own content (for example, a YouTuber using a video generator) are users and not subject to the duty.

**Why it matters for game assets.** The draft is about **marketing copy** more than the game. A line like "endless maps generated by AI" should come with the actual scope and limits of the feature. On the AI Basic Act, the commentary puts the weight on service providers rather than people who use AI as a production tool, so if your game offers AI generation to players, it is worth checking which side your team falls on. The same newsletter reads the duty as requiring game operators with AI features to tell players when a character or NPC is AI.

**What to do.**
- Find every sentence with "AI" in your store description and press materials and add one sentence on what it actually does.
- Comments are open until November 11; if your indie studio has a case the draft leaves unclear, this is the time to say so.

## 3. The EU and the US — training-data rules are still open

**What happened.** Pinsent Masons reported on October 6 that the European Commission is taking views on generative AI and copyright until November 3. Options include standards for opt-out protocols and an EU opt-out registry, "fair compensation" from AI providers relying on the text and data mining exception, and transparency duties such as disclosing crawler use; a presumption of use against providers that fail their AI Act transparency duties was also floated. The same article reports that a US appeals court found Ross Intelligence's use of Thomson Reuters material was not fair use, with commentary warning against reading it as a general rule on AI training.

There are voices on the other side. In an October 30 post about the amicus brief it filed in In re OpenAI, EFF argues that requiring permission for every work would favour the largest companies; the post quotes Professor Lawrence Lessig: "If all training requires a license, then none but a handful of tech giants will be able to afford the costs of training."

**Why it matters for game assets.** Whichever way training rules go, they reach us as **changes to model license terms**. FLUX 3 Image Klein, released the same month, already splits free commercial use by annual revenue; terms differ by model and can change.

**What to do.**
- Keep your own original working files with their layers. They are the clearest evidence of which parts are human work.
- If you do not want your art used for training, remember the EU opt-out registry is only a proposal, and check the settings of the platforms you post to now.

## Takeaway: one page of records is enough

All of this month's news comes down to one habit: **for each asset, one line on what made it, when, and under which terms.** The Steam survey, Korean ad rules and future license changes all ask that question. The format does not need to be fancy: file name, tool and version, date, license link, and what a person changed.
