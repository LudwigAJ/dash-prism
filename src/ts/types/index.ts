// =============================================================================
// Namespace Types
// =============================================================================

// TabId, PanelId and LayoutId are plain strings. The names only tell which id a value holds.
export type TabId = string;
export type PanelId = string;
export type LayoutId = string;
type PanelOrder = 0 | 1;
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

/** Holds one tab: its name, its panel and the layout that it shows. */
export interface Tab {
  id: TabId;
  name: string;
  panelId: PanelId;
  createdAt: number;
  /** The registered layout that the tab shows. An empty tab has none. */
  layoutId?: LayoutId;
  layoutOption?: string;
  layoutParams?: Record<string, string>;

  locked?: boolean;
  /** A random React key of the tab content. A refresh replaces it to mount the content again. */
  mountKey?: string;

  icon?: string;
  style?: string;
}

/** Holds one node of the panel tree. A node without children is a leaf panel that holds tabs. */
export interface PanelNode {
  id: PanelId;
  order: PanelOrder;
  direction: PanelDirection;
  pinned?: boolean;
  children: PanelNode[];
  /** The size in the parent split, as react-split-pane takes it: '50%', or pixels after resize. */
  size?: string | number;
}

// =============================================================================
// Drag and Drop Types
// =============================================================================

/** Holds the dnd-kit data of a panel edge drop zone. A drop there splits the panel. */
export interface PanelEdgeDropData {
  panelId: PanelId;
  edge: 'left' | 'right' | 'top' | 'bottom';
}

/** Holds the dnd-kit data of the tab bar of a panel. A drop there moves the tab to the panel. */
export interface TabBarDropData {
  type: 'tab-bar';
  panelId: PanelId;
}

/** Holds the dnd-kit data of a tab. A drop on a tab puts the dragged tab at its position. */
export interface TabDragData {
  type: 'tab';
  tab: Tab;
  panelId: PanelId;
}

/** Holds the data of a Prism droppable. */
export type DropData = PanelEdgeDropData | TabBarDropData | TabDragData;

// =============================================================================
// Layout Types
// =============================================================================

export type ParamType =
  'string' | 'integer' | 'number' | 'boolean' | 'enum' | 'array' | 'object' | 'unknown';

export interface ParamConstraints {
  minimum?: number;
  exclusiveMinimum?: number;
  maximum?: number;
  exclusiveMaximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

// `null` here is a JSON scalar that a default or a choice can hold. It does not
// mean that the value is absent.
type ParamScalar = string | number | boolean | null;

/** Mirrors dash_prism.params.LayoutParameter.to_dict() */
export interface LayoutParam {
  name: string;
  hasDefault: boolean;
  /** The JSON-safe default value. */
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

/** Maps each layout id to its metadata, as dash_prism.init sends it. */
export type RegisteredLayouts = Record<string, LayoutMeta>;

// =============================================================================
// Workspace Types (Persistence)
// =============================================================================

/** The workspace as Dash sees it: the shape of the `readWorkspace` and `updateWorkspace` props. */
export interface Workspace {
  tabs: Tab[];
  panel: PanelNode;
  panelTabs: Record<PanelId, TabId[]>; // Order per panel
  activeTabIds: Record<PanelId, TabId>;
  activePanelId: PanelId;
  favoriteLayouts?: LayoutId[];
  searchBarsHidden?: boolean;
}

// =============================================================================
// Share Link Types (URL-based tab sharing)
// =============================================================================

/**
 * Data structure for shareable tab links.
 * Encoded as base64 JSON in URL hash: #p:<base64>
 */
export interface ShareData {
  layoutId: string;
  name?: string;
  layoutParams?: Record<string, string>;
  layoutOption?: string;
}

// =============================================================================
// Dash Component API Types (for ExternalWrapper and loading states)
// =============================================================================

/** Holds the props of a Dash component spec: an optional id and any other prop. */
interface BaseDashProps {
  id?: string | Record<string, string>;
  [propName: string]: unknown;
}

/** Holds a Dash component spec, the JSON form of a component in the Dash layout. */
export interface DashComponent {
  type: string;
  namespace: string;
  props: BaseDashProps;
}

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

/** The keys and indexes that lead to one component in the Dash layout tree. */
type DashPath = Array<string | number>;

/**
 * Props for ExternalWrapper component
 */
interface ExternalWrapperProps {
  component: DashComponent;
  componentPath: DashPath;
  temp?: boolean;
}

/**
 * Dash context type returned by useDashContext
 */
interface DashContextType {
  componentPath: DashPath;
  useLoading: (options?: {
    extraPath?: DashPath;
    rawPath?: DashPath; // fix a bug in Dash
    filterFunc?: (loading: unknown) => boolean;
  }) => boolean;
  useStore: () => unknown;
  useDispatch: () => unknown;
}

/**
 * Type for window.dash_component_api (Dash 3.1.1+)
 */
export interface DashComponentApi {
  ExternalWrapper: React.ComponentType<ExternalWrapperProps>;
  useDashContext: () => DashContextType;
  DashContext: React.Context<DashContextType | undefined>;
  getLayout: (path: DashPath | string) => Record<string, unknown> | null;
  stringifyId: (id: string | Record<string, unknown>) => string;
}

// Augment global Window interface
declare global {
  interface Window {
    dash_component_api?: DashComponentApi;
  }
}
