import type { LucideIcon } from 'lucide-react';
import { DashComponentProps } from '../props';

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

export type LayoutParam = {
  name: string;
  hasDefault: boolean;
  default?: string;
};

export type LayoutOption = {
  description?: string;
  params: Record<string, string>;
};

export type LayoutMeta = {
  name: string;
  description?: string;
  keywords?: string[];
  allowMultiple?: boolean;
  params?: LayoutParam[];
  paramOptions?: Record<string, LayoutOption>;
};

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
  theme?: Theme;
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
  [key: string]: any;
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
 * Type guard to check if a value is a DashComponent.
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
  componentPath: (string | number)[];
  temp?: boolean;
};

/**
 * Dash context type returned by useDashContext
 */
export type DashContextType = {
  componentPath: (string | number)[];
  useLoading: (options?: {
    extraPath?: (string | number)[];
    rawPath?: (string | number)[]; // fix a bug in Dash
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
  getLayout: (path: (string | number)[] | string) => Record<string, unknown> | null;
  stringifyId: (id: string | Record<string, unknown>) => string;
};

// Augment global Window interface
declare global {
  interface Window {
    dash_component_api?: DashComponentApi;
  }
}
