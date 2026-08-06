import { useCallback, useEffect, useRef } from "react";
import { allocNodeId, bind, setClass, setText, setVar, unbind } from "./runtime";

/**
 * React bridge for ChronosGPU.
 *
 * `useChronosNode` hands back a ref callback plus imperative setters. Values
 * pushed through it bypass React entirely: they are encoded into the shared
 * buffer and applied by the rAF consumer, so a counter ticking 60× per second
 * costs zero renders and zero garbage.
 */
export function useChronosNode<T extends HTMLElement = HTMLElement>() {
  const idRef = useRef<number>(0);
  if (idRef.current === 0) idRef.current = allocNodeId();

  const ref = useCallback((el: T | null) => {
    bind(idRef.current, el);
  }, []);

  useEffect(() => () => unbind(idRef.current), []);

  return {
    ref,
    id: idRef.current,
    setText: useCallback((v: string) => setText(idRef.current, v), []),
    setClass: useCallback((v: string) => setClass(idRef.current, v), []),
    setVar: useCallback((n: string, v: string) => setVar(idRef.current, n, v), []),
  };
}

/** Mirror a changing value into the DOM without re-rendering the tree. */
export function useChronosText(value: string) {
  const node = useChronosNode<HTMLSpanElement>();
  useEffect(() => {
    node.setText(value);
  }, [value, node]);
  return node.ref;
}
