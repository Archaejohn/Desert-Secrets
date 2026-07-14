/**
 * Branching dialogue core. Engine-agnostic, no Phaser imports.
 * See docs/CONTRACTS.md section 2.
 */

export interface DialogueLine {
  speaker: string;
  text: string;
}

export interface DialogueChoice {
  text: string;
  next: string;
}

export interface DialogueNode {
  id: string;
  lines: DialogueLine[];
  choices?: DialogueChoice[];
  next?: string;
}

export interface DialogueScript {
  start: string;
  nodes: DialogueNode[];
}

/**
 * Throws with a descriptive message on: missing/unknown start node,
 * duplicate node ids, nodes with zero lines, choice.next or node.next
 * referencing a nonexistent node, or a node having both choices and next.
 */
export function validateScript(script: DialogueScript): void {
  if (!script.start) {
    throw new Error("Dialogue script has no start node id");
  }
  const ids = new Set<string>();
  for (const node of script.nodes) {
    if (ids.has(node.id)) {
      throw new Error(`Duplicate dialogue node id "${node.id}"`);
    }
    ids.add(node.id);
  }
  if (!ids.has(script.start)) {
    throw new Error(
      `Dialogue start node "${script.start}" does not exist in the script`,
    );
  }
  for (const node of script.nodes) {
    if (node.lines.length === 0) {
      throw new Error(`Dialogue node "${node.id}" has zero lines`);
    }
    if (node.choices !== undefined && node.next !== undefined) {
      throw new Error(
        `Dialogue node "${node.id}" has both choices and next; pick one`,
      );
    }
    if (node.choices !== undefined && node.choices.length === 0) {
      throw new Error(`Dialogue node "${node.id}" has an empty choices array`);
    }
    if (node.next !== undefined && !ids.has(node.next)) {
      throw new Error(
        `Dialogue node "${node.id}" points to nonexistent node "${node.next}"`,
      );
    }
    for (const choice of node.choices ?? []) {
      if (!ids.has(choice.next)) {
        throw new Error(
          `Choice "${choice.text}" on node "${node.id}" points to nonexistent node "${choice.next}"`,
        );
      }
    }
  }
}

export class DialogueRunner {
  private script: DialogueScript;
  private byId: Map<string, DialogueNode>;
  private node: DialogueNode | null = null;
  private lineIndex = 0;
  private started = false;
  private finished = false;

  constructor(script: DialogueScript) {
    validateScript(script);
    this.script = script;
    this.byId = new Map(script.nodes.map((n) => [n.id, n]));
  }

  /** Begin (or restart) the dialogue; returns the first line of the start node. */
  start(): DialogueLine {
    this.node = this.byId.get(this.script.start)!;
    this.lineIndex = 0;
    this.started = true;
    this.finished = false;
    return this.node.lines[0];
  }

  get active(): boolean {
    return this.started && !this.finished;
  }

  get currentLine(): DialogueLine | null {
    if (!this.active || this.node === null) return null;
    return this.node.lines[this.lineIndex];
  }

  /**
   * Id of the node the runner is currently in — null before start() and
   * after the script ends. Scenes branch on terminal node ids by reading
   * this on the last line before the final advance().
   */
  get currentNodeId(): string | null {
    if (!this.active || this.node === null) return null;
    return this.node.id;
  }

  /** Choices for the current node — only non-null on its last line. */
  get choices(): DialogueChoice[] | null {
    if (!this.active || this.node === null) return null;
    if (this.lineIndex !== this.node.lines.length - 1) return null;
    return this.node.choices ?? null;
  }

  /**
   * Advance to the next line/node. Pass choiceIndex when choices is
   * non-null. Returns null when the script ends.
   */
  advance(choiceIndex?: number): DialogueLine | null {
    if (!this.active || this.node === null) {
      throw new Error(
        "DialogueRunner: cannot advance — dialogue is not active (call start())",
      );
    }
    const pendingChoices = this.choices;
    if (pendingChoices !== null) {
      if (choiceIndex === undefined) {
        throw new Error(
          "DialogueRunner: choices are pending; advance(choiceIndex) is required",
        );
      }
      if (
        !Number.isInteger(choiceIndex) ||
        choiceIndex < 0 ||
        choiceIndex >= pendingChoices.length
      ) {
        throw new Error(
          `DialogueRunner: choice index ${choiceIndex} out of range (0..${pendingChoices.length - 1})`,
        );
      }
      this.node = this.byId.get(pendingChoices[choiceIndex].next)!;
      this.lineIndex = 0;
      return this.node.lines[0];
    }
    if (choiceIndex !== undefined) {
      throw new Error(
        "DialogueRunner: no choices are pending; call advance() without an index",
      );
    }
    if (this.lineIndex < this.node.lines.length - 1) {
      this.lineIndex += 1;
      return this.node.lines[this.lineIndex];
    }
    if (this.node.next !== undefined) {
      this.node = this.byId.get(this.node.next)!;
      this.lineIndex = 0;
      return this.node.lines[0];
    }
    // Last line of a terminal node: dialogue ends.
    this.finished = true;
    this.node = null;
    return null;
  }
}
