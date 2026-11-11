import type * as Lib from "metabase-lib";

import type { SummaryWellId } from "../types";

/** The formula behind a well's chip. An unnamed one takes its name from the edited source. */
export type SummaryFormula = {
  wellId: SummaryWellId;
  key: string;
  clause: Lib.AggregationClause | Lib.ExpressionClause;
  name?: string;
};

export type SummaryFormulaBarOptions = {
  query: Lib.Query;
  stageIndex: number;
  onAdd: (query: Lib.Query, wellId: SummaryWellId) => void;
  onEdit: (query: Lib.Query, formula: SummaryFormula) => void;
};

export type SummaryFormulaDraft = {
  key: number;
  wellId: SummaryWellId;
  source: string;
} & ({ kind: "new" } | { kind: "edit"; itemKey: string });

export type SummaryFormulaInput = {
  start: (source: string, input: HTMLInputElement, onReady: () => void) => void;
  isPending: () => boolean;
  update: (source: string) => void;
  edit: (itemKey: string, input: HTMLInputElement | null) => void;
};
