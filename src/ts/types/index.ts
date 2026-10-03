import type { LucideIcon } from 'lucide-react';

export type { LucideIcon };

// =============================================================================
// Namespace Types
// =============================================================================

export type TabId = string;
export type PanelId = string;
export type LayoutId = string;
export type PanelOrder = 0 | 1;
export type PanelDirection = 'vertical' | 'horizontal';
export type PersistenceType = 'memory' | 'session' | 'local';
export type Theme = 'light' | 'dark';
export type Size = 'sm' | 'md' | 'lg';
export type StatusBarPosition = 'top' | 'bottom';
/** What an empty tab (no layout selected) renders in its body. */
export type EmptyTabView = 'layouts' | 'hint' | 'none';
/** A built-in status bar segment; see the statusBarItems prop. */
export type StatusBarItem =
  'reset' | 'help' | 'undo' | 'mode' | 'panels' | 'tab' | 'count' | 'updated';

// =============================================================================
// Core Types
// =============================================================================

export type Tab = {
  id: TabId;
  name: string;
  panelId: PanelId;
  createdAt: number;
  /** Layout ID or empty string if no layout assigned */
  layoutId?: LayoutId;
  layoutOption?: string;
  layoutParams?: Record<string, string>;

  locked?: boolean;
  /** UUID for React key; regenerated on refresh to force remount. Auto-generated if missing. */
  mountKey?: string;

  icon?: string;
  style?: string;
};

export type PanelNode = {
  id: PanelId;
  order: PanelOrder;
  direction: PanelDirection;
  pinned?: boolean;
  children: PanelNode[];
  /** Size as percentage (0-100) */
  size?: string | number;
};

// =============================================================================
// Layout Types
// =============================================================================

export type ParamType =
  'string' | 'integer' | 'number' | 'boolean' | 'enum' | 'array' | 'object' | 'unknown';

export type ParamConstraints = {
  minimum?: number;
  exclusiveMinimum?: number;
  maximum?: number;
  exclusiveMaximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
};

// `null` here is a JSON scalar that a default or a choice can hold. It does not
// mean that the value is absent.
export type ParamScalar = string | number | boolean | null;

/** Mirrors dash_prism.params.LayoutParameter.to_dict() */
export interface LayoutParam {
  name: string;
  hasDefault: boolean;
  /** JSON-safe default (was typed `string` before 1.0, but was always `Any`). */
  default?: ParamScalar | ParamScalar[];
  annotation?: string | null;
  type?: ParamType;
  required?: boolean;
  nullable?: boolean;
  choices?: ParamScalar[] | null;
  items?: ParamType | null;
  constraints?: ParamConstraints;
  description?: string | null;
  title?: string | null;
  examples?: ParamScalar[] | null;
  placeholder?: string | null;
}

/** One entry of `paramOptions`: a named set of parameter values for a layout. */
export interface LayoutOption {
  description?: string;
  // A preset can hold any JSON value, such as an object for a dict parameter.
  params: Record<string, unknown>;
}

/** Mirrors dash_prism.registry.LayoutRegistration.to_metadata() */
export interface LayoutMeta {
  name: string;
  description?: string;
  keywords?: string[];
  allowMultiple?: boolean;
  params?: LayoutParam[];
  // Python sends null, not an absent key, for a layout without options.
  paramOptions?: Record<string, LayoutOption> | null;
}

export type RegisteredLayouts = Record<string, LayoutMeta>;

// =============================================================================
// Workspace Types (Persistence)
// =============================================================================

export type Workspace = {
  tabs: Tab[];
  panel: PanelNode;
  panelTabs: Record<PanelId, TabId[]>; // Order per panel
  activeTabIds: Record<PanelId, TabId>;
  activePanelId: PanelId;
  favoriteLayouts?: string[];
  searchBarsHidden?: boolean;
};

// =============================================================================
// Actions Prop Types (Developer-defined buttons in StatusBar)
// =============================================================================

export type PrismActionDef = {
  id: string;
  label: string;
  icon?: string;
  variant?: string;
  tooltip?: string;
  disabled?: boolean;
};

// =============================================================================
// Share Link Types (URL-based tab sharing)
// =============================================================================

/**
 * Data structure for shareable tab links.
 * Encoded as base64 JSON in URL hash: #p:<base64>
 */
export type ShareData = {
  layoutId: string;
  name?: string;
  layoutParams?: Record<string, string>;
  layoutOption?: string;
};

// =============================================================================
// Notification Types (Handled by Sonner - not in Redux)
// =============================================================================

// Notifications are managed by Sonner library, not Redux.
// See: Reversibility Philosophy section
// Usage: import { toast } from 'sonner'; toast.success('Message');

// =============================================================================
// Dash Component API Types (for ExternalWrapper and loading states)
// =============================================================================

/**
 * Dash component specification format (from https://github.com/plotly/dash)
 */
export type BaseDashProps = {
  id?: string | Record<string, string>;
  [propName: string]: unknown;
};

/**
 * Dash component specification format (from https://github.com/plotly/dash)
 */
export type DashComponent = {
  type: string;
  namespace: string;
  props: BaseDashProps;
};

/**
 * Checks if a value is a DashComponent.
 * Useful for runtime validation of Dash-serialized React elements.
 */
export function isDashComponent(value: unknown): value is DashComponent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'namespace' in value &&
    'props' in value &&
    typeof (value as DashComponent).type === 'string' &&
    typeof (value as DashComponent).namespace === 'string' &&
    typeof (value as DashComponent).props === 'object' &&
    (value as DashComponent).props !== null &&
    !Array.isArray((value as DashComponent).props)
  );
}

/**
 * Props for ExternalWrapper component
 */
export type ExternalWrapperProps = {
  component: DashComponent;
  componentPath: Array<string | number>;
  temp?: boolean;
};

/**
 * Dash context type returned by useDashContext
 */
export type DashContextType = {
  componentPath: Array<string | number>;
  useLoading: (options?: {
    extraPath?: Array<string | number>;
    rawPath?: Array<string | number>; // fix a bug in Dash
    filterFunc?: (loading: unknown) => boolean;
  }) => boolean;
  useStore: () => unknown;
  useDispatch: () => unknown;
};

/**
 * Type for window.dash_component_api (Dash 3.1.1+)
 */
export type DashComponentApi = {
  ExternalWrapper: React.ComponentType<ExternalWrapperProps>;
  useDashContext: () => DashContextType;
  DashContext: React.Context<DashContextType | undefined>;
  getLayout: (path: Array<string | number> | string) => Record<string, unknown> | null;
  stringifyId: (id: string | Record<string, unknown>) => string;
};

// Augment global Window interface
declare global {
  interface Window {
    dash_component_api?: DashComponentApi;
  }
}
