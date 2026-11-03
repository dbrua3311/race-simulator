import { uniform, type RngState } from '../core/rng';
import { parameterCount, type Genome } from './network';
import { INITIAL_GENE_RANGE } from './params';

/** 첫 세대용 무작위 유전자 */
export function randomGenome(rng: RngState): Genome {
  return Array.from({ length: parameterCount() }, () => uniform(rng, -INITIAL_GENE_RANGE, INITIAL_GENE_RANGE));
}
