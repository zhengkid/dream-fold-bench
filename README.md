# Dream-Folding-Bench

**Can Coding Agents Fold Proteins on Their Own?**

Dream-Folding-Bench is a benchmark that asks general-purpose coding agents to predict the three-dimensional structure of a protein from its amino acid sequence. An agent has a fixed time budget, a terminal, and the code it writes during the session. It may not call or train an auxiliary neural network.

> **Status:** the code will be released soon. See the [release plan](#release-plan) below.

## The benchmark at a glance

| | |
|---|---|
| **Task** | Given one amino acid sequence, submit an all-atom structure of the full chain as `model.pdb`. |
| **Targets** | 53 single-chain targets from CASP16 (2024), covering 75 official CASP16 evaluation units. |
| **Budget** | 3 hours and 1 CPU core per target. No internet access. |
| **Rule** | No auxiliary neural networks: no pretrained structure predictors, no protein language models, no networks trained during the session. |
| **Closed-book setting** | No database and no search program: the agent has the sequence, what it knows, and what it can compute. |
| **Open-book setting** | The Protein Data Bank restricted to entries released before the target, the sequence databases UniRef30, BFD and MGnify, and the search tools HH-suite, MMseqs2 and HMMER. |
| **Tools** | **3D visual feedback:** a renderer draws any candidate structure from several viewpoints, together with its contact map, as an image the agent can look at. **Evaluator:** stereochemical checks and a force-field energy. |
| **Scoring** | After the session, the submitted structure is compared with the experimental structure on the official CASP16 evaluation units. GDT_TS is the primary metric; TM-score and lDDT are also reported. A missing or invalid submission scores zero. |

Each session runs in its own sandbox. Reference structures, scoring code and scores stay outside it.

## What we find

We evaluate 12 frontier coding agents from Anthropic, Google and OpenAI in three agent harnesses (Claude Code, Gemini CLI and Codex CLI).

- **Leaderboard.** The best agent, Claude Fable 5.2, reaches a mean GDT_TS of 56.9 in the open-book setting and 24.1 in the closed-book setting. AlphaFold 3 scored 85.4 on the same evaluation units at CASP16.
- **Databases matter.** Access to sequence and structure databases is worth more than 30 GDT_TS points to the leading agents.
- **Agents are template modellers.** With database access, agents approach AlphaFold 3 on targets with a close structural template. On targets for which template search finds no match, their mean GDT_TS falls below half of AlphaFold 3's.
- **Feedback offers limited guidance.** Feedback from a traditional force field and from Rosetta barely outperforms random guessing when selecting the better of two attempts by the same agent. Replacing one evaluator with the other changes the mean GDT_TS by at most 1.5 points, with no consistent advantage for either.

## Release plan

- [ ] Paper
- [ ] Project page: leaderboard, results, and replays of agent sessions
- [ ] Benchmark code: task and agent harnesses, sandbox, evaluators, and scoring
- [ ] Target list and instructions for obtaining the CASP16 reference structures
- [ ] Per-target results of all evaluated agents

This list will be updated as items are released.

## Citation

If you use Dream-Folding-Bench, please cite this repository:

```bibtex
@misc{dreamfoldingbench2026,
  title        = {Dream-Folding-Bench: Can Coding Agents Fold Proteins on Their Own?},
  year         = {2026},
  howpublished = {\url{https://github.com/zhengkid/dream-folding-bench}},
  note         = {GitHub repository}
}
```
