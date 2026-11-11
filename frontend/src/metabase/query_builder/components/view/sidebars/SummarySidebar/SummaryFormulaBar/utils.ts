import type { NamedExpression } from "metabase/querying/components/FormulaEditor";
import { checkNotNull } from "metabase/utils/types";
import * as Lib from "metabase-lib";
import { getUniqueExpressionName } from "metabase-lib/v1/queries/utils/expression";

import type { SummaryWellId } from "../types";
import { getDimensionItems, getValueItems } from "../utils";

import type { SummaryFormula } from "./types";

export function addSummaryFormula(
  query: Lib.Query,
  stageIndex: number,
  wellId: SummaryWellId,
  { name, clause }: NamedExpression,
): Lib.Query {
  if (wellId === "values") {
    return Lib.aggregate(
      query,
      stageIndex,
      Lib.withExpressionName(clause, name),
    );
  }
  const uniqueName = getUniqueExpressionName(query, stageIndex, name);
  const nextQuery = Lib.expression(query, stageIndex, uniqueName, clause);
  const column = Lib.breakoutableColumns(nextQuery, stageIndex).find(
    (column) => {
      const info = Lib.displayInfo(nextQuery, stageIndex, column);
      return info.isCalculated && info.displayName === uniqueName;
    },
  );
  return Lib.breakout(
    nextQuery,
    stageIndex,
    Lib.withDefaultBucket(nextQuery, stageIndex, checkNotNull(column)),
  );
}

export function findSummaryFormula(
  query: Lib.Query,
  stageIndex: number,
  wellId: SummaryWellId,
  key: string,
): SummaryFormula | null {
  if (wellId === "values") {
    const item = getValueItems(query, stageIndex).find(
      (item) => item.key === key,
    );
    if (item?.kind !== "expression") {
      return null;
    }
    const { displayName, isNamed } = Lib.displayInfo(
      query,
      stageIndex,
      item.clause,
    );
    return {
      wellId,
      key,
      clause: item.clause,
      name: isNamed ? displayName : undefined,
    };
  }
  const item = getDimensionItems(query, stageIndex).find(
    (item) => item.key === key,
  );
  if (!item?.expression) {
    return null;
  }
  return {
    wellId,
    key,
    clause: item.expression,
    name: Lib.displayInfo(query, stageIndex, item.expression).displayName,
  };
}

function getFormulaBreakouts(
  query: Lib.Query,
  stageIndex: number,
  name: string,
): Lib.BreakoutClause[] {
  return getDimensionItems(query, stageIndex)
    .filter(
      (item) =>
        item.expression &&
        Lib.displayInfo(query, stageIndex, item.expression).displayName ===
          name,
    )
    .map((item) => item.clause);
}

function findBucket(
  query: Lib.Query,
  stageIndex: number,
  buckets: Lib.Bucket[],
  bucket: Lib.Bucket,
): Lib.Bucket | undefined {
  const { shortName, displayName } = Lib.displayInfo(query, stageIndex, bucket);
  return buckets.find((candidate) => {
    const info = Lib.displayInfo(query, stageIndex, candidate);
    return info.shortName === shortName && info.displayName === displayName;
  });
}

/** Carries a grouping's bucket over to the edited formula, or picks the default for its new type. */
function withPreviousBucket(
  query: Lib.Query,
  stageIndex: number,
  column: Lib.ColumnMetadata,
  previousBreakout: Lib.BreakoutClause | undefined,
): Lib.ColumnMetadata {
  const temporalBucket =
    previousBreakout && Lib.temporalBucket(previousBreakout);
  const binning = previousBreakout && Lib.binning(previousBreakout);
  if (temporalBucket) {
    const bucket = findBucket(
      query,
      stageIndex,
      Lib.availableTemporalBuckets(query, stageIndex, column),
      temporalBucket,
    );
    if (bucket) {
      return Lib.withTemporalBucket(column, bucket);
    }
  }
  if (binning) {
    const bucket = findBucket(
      query,
      stageIndex,
      Lib.availableBinningStrategies(query, stageIndex, column),
      binning,
    );
    if (bucket) {
      return Lib.withBinning(column, bucket);
    }
  }
  return Lib.withDefaultBucket(query, stageIndex, column);
}

/** The formula keeps its name: renaming happens on its chip. */
export function replaceSummaryFormula(
  query: Lib.Query,
  stageIndex: number,
  formula: SummaryFormula,
  { name, clause }: NamedExpression,
): Lib.Query {
  const formulaName = formula.name ?? name;
  const nextQuery = Lib.replaceClause(
    query,
    stageIndex,
    formula.clause,
    Lib.withExpressionName(clause, formulaName),
  );
  if (formula.wellId === "values") {
    return nextQuery;
  }
  // Lib keeps a grouping's bucket through a rename only, not through a changed formula.
  const previousBreakouts = getFormulaBreakouts(query, stageIndex, formulaName);
  return getFormulaBreakouts(nextQuery, stageIndex, formulaName).reduce(
    (currentQuery, breakout, index) => {
      const column = Lib.breakoutColumn(currentQuery, stageIndex, breakout);
      if (!column) {
        return currentQuery;
      }
      return Lib.replaceClause(
        currentQuery,
        stageIndex,
        breakout,
        withPreviousBucket(
          currentQuery,
          stageIndex,
          column,
          previousBreakouts[index],
        ),
      );
    },
    nextQuery,
  );
}
