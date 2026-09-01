import { useCallback, useState } from 'react';
import type { StaircaseConfig, StaircaseState } from '../types/staircase';
import { initStaircaseState, stepStaircase } from '../utils/staircaseUtils';

export interface UseStaircaseReturn {
  currentValue: number;
  respond: (correct: boolean) => void;
  state: StaircaseState;
  reset: () => void;
}

export function useStaircase(config: StaircaseConfig): UseStaircaseReturn {
  const [state, setState] = useState<StaircaseState>(() => initStaircaseState(config));

  const respond = useCallback(
    (correct: boolean) => {
      setState((prev) => stepStaircase(config, prev, correct));
    },
    [config],
  );

  const reset = useCallback(() => {
    setState(initStaircaseState(config));
  }, [config]);

  return { currentValue: state.currentValue, respond, state, reset };
}
