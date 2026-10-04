/** Holds the props that Dash gives to every component. */
export interface DashComponentProps {
  /**
   * Unique ID to identify this component in Dash callbacks.
   */
  id?: string;
  /**
   * Updates props to trigger callbacks.
   */
  setProps: (props: Record<string, unknown>) => void;
}
