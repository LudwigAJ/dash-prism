"""
Dash Prism Usage Example
========================

This example demonstrates the full Prism API with all demo layouts.
All layouts and callbacks are defined in this single file.
"""

import time
from datetime import datetime

import dash
from dash import html, dcc, callback, Input, Output, State, MATCH, ctx
from dash.exceptions import PreventUpdate
import plotly.express as px
0 

import dash_prism


# =============================================================================
# SETTINGS LAYOUT
# =============================================================================

@dash_prism.register_layout(
    id='settings',
    name='Settings',
    description='Configure Prism theme and interface settings',
    keywords=['settings', 'config', 'configuration', 'theme', 'preferences'],
    allow_multiple=False,
)
def settings_layout():
    """Settings page to configure theme and size."""
    return html.Div([
        html.Div([
            html.H1('⚙️ Settings', style={'margin': '0'}),
            html.P('Configure your workspace', style={'color': '#666', 'margin': '5px 0 0 0'}),
        ], style={'padding': '20px', 'borderBottom': '1px solid #eee'}),

        html.Div([
            # Theme
            html.Div([
                html.Label('Theme', style={'fontWeight': 'bold', 'display': 'block', 'marginBottom': '8px'}),
                dcc.Dropdown(
                    id='settings-theme',
                    options=[
                        {'label': '☀️ Light', 'value': 'light'},
                        {'label': '🌙 Dark', 'value': 'dark'},
                    ],
                    value='light',
                    clearable=False,
                    style={'width': '200px'},
                ),
            ], style={'marginBottom': '20px'}),

            # Size
            html.Div([
                html.Label('Interface Size', style={'fontWeight': 'bold', 'display': 'block', 'marginBottom': '8px'}),
                dcc.Dropdown(
                    id='settings-size',
                    options=[
                        {'label': 'Small', 'value': 'sm'},
                        {'label': 'Medium', 'value': 'md'},
                        {'label': 'Large', 'value': 'lg'},
                    ],
                    value='md',
                    clearable=False,
                    style={'width': '200px'},
                ),
            ], style={'marginBottom': '20px'}),

            # Apply button
            html.Button(
                '✓ Apply Settings',
                id='settings-apply-btn',
                n_clicks=0,
                style={
                    'padding': '12px 24px',
                    'backgroundColor': '#4CAF50',
                    'color': 'white',
                    'border': 'none',
                    'borderRadius': '4px',
                    'cursor': 'pointer',
                    'fontWeight': 'bold',
                },
            ),
            html.Span(id='settings-status', style={'marginLeft': '15px', 'color': '#4CAF50'}),
        ], style={'padding': '20px', 'maxWidth': '400px'}),
    ], style={'backgroundColor': 'white', 'minHeight': '100%'})


# =============================================================================
# CHAT LAYOUT
# =============================================================================

# Simple in-memory chat store
_chat_messages = [
    {'username': 'System', 'text': 'Welcome to the chat room!', 'timestamp': datetime.now().isoformat()},
]


@dash_prism.register_layout(
    id='chat',
    name='Chat Room',
    description='Old-school chat room with text formatting',
    keywords=['chat', 'messaging', 'communication', 'talk'],
    allow_multiple=True,
)
def chat_layout(username: str = 'Anonymous', theme: str = 'dark'):
    """Chat room layout with theme support.

    Args:
        username: Display name for the user
        theme: 'light' or 'dark' theme
    """
    # Define theme colors
    if theme == 'light':
        bg_color = '#ffffff'
        text_color = '#2c3e50'
        surface_color = '#f5f7f8'
        input_bg = '#ffffff'
        border_color = '#d5dbdf'
        header_text = '#2c3e50'
        subtext_color = '#7f8c8d'
    else:  # dark
        bg_color = '#0f1419'
        text_color = '#00ff00'
        surface_color = '#16213e'
        input_bg = '#0f1419'
        border_color = '#00ff00'
        header_text = '#00ff00'
        subtext_color = '#00ff00'

    return html.Div([
        # Header
        html.Div([
            html.H3('Chat Room', style={
                'margin': '0',
                'fontFamily': 'Monaco, "Courier New", monospace',
                'color': header_text,
                'fontSize': '18px',
            }),
            html.Span(f'User: {username}', style={
                'fontFamily': 'Monaco, "Courier New", monospace',
                'color': subtext_color,
                'fontSize': '13px',
            }),
        ], style={
            'display': 'flex',
            'justifyContent': 'space-between',
            'alignItems': 'center',
            'padding': '12px 16px',
            'backgroundColor': surface_color,
            'borderBottom': f'1px solid {border_color}',
        }),

        dcc.Store(id='chat-username', data=username),

        # Messages container
        html.Div(
            id='chat-messages',
            children='*** No messages yet. Start chatting! ***\n',
            style={
                'flex': '1',
                'overflow': 'auto',
                'padding': '16px',
                'fontFamily': 'Monaco, "Courier New", monospace',
                'fontSize': '13px',
                'lineHeight': '1.6',
                'backgroundColor': bg_color,
                'color': text_color,
                'whiteSpace': 'pre-wrap',
                'wordWrap': 'break-word',
            },
        ),

        # Input area
        html.Div([
            dcc.Textarea(
                id='chat-input',
                placeholder='Type a message...',
                style={
                    'width': '100%',
                    'minHeight': '60px',
                    'padding': '12px',
                    'fontFamily': 'Monaco, "Courier New", monospace',
                    'fontSize': '13px',
                    'backgroundColor': input_bg,
                    'color': text_color,
                    'border': f'1px solid {border_color}',
                    'borderRadius': '4px',
                    'resize': 'none',
                    'outline': 'none',
                },
                rows=2,
            ),
            html.Button(
                'Send',
                id='chat-send-btn',
                n_clicks=0,
                style={
                    'marginTop': '8px',
                    'padding': '8px 24px',
                    'fontFamily': 'Monaco, "Courier New", monospace',
                    'backgroundColor': '#4CAF50',
                    'color': '#ffffff',
                    'border': 'none',
                    'borderRadius': '4px',
                    'cursor': 'pointer',
                    'fontSize': '13px',
                    'fontWeight': 'bold',
                },
            ),
        ], style={
            'padding': '12px 16px',
            'backgroundColor': surface_color,
            'borderTop': f'1px solid {border_color}',
        }),

        dcc.Interval(id='chat-interval', interval=2000, n_intervals=0),
    ], style={
        'height': '100%',
        'display': 'flex',
        'flexDirection': 'column',
        'backgroundColor': bg_color,
    })


# =============================================================================
# ASSET LAYOUT
# =============================================================================

ASSET_CONFIG = {
    'BTC': (45000.0, 0.02),
    'ETH': (3000.0, 0.025),
    'AAPL': (175.0, 0.015),
    'GOOGL': (140.0, 0.018),
    'TSLA': (250.0, 0.03),
    'MSFT': (380.0, 0.012),
    'GOLD': (2000.0, 0.008),
    'OIL': (75.0, 0.02),
}




@dash_prism.register_layout(
    id='asset',
    name='Asset Price',
    description='Real-time asset price dashboard with GBM or RM simulation',
    keywords=['asset', 'price', 'stock', 'crypto', 'trading', 'finance'],
    allow_multiple=True,
    param_options={
        'btc': ('Bitcoin (BTC)', {'asset': 'BTC'}),
        'eth': ('Ethereum (ETH)', {'asset': 'ETH'}),
        'aapl': ('Apple (AAPL)', {'asset': 'AAPL'}),
        'googl': ('Google (GOOGL)', {'asset': 'GOOGL'}),
        'tsla': ('Tesla (TSLA)', {'asset': 'TSLA'}),
        'msft': ('Microsoft (MSFT)', {'asset': 'MSFT'}),
        'gold': ('Gold', {'asset': 'GOLD'}),
        'oil': ('Oil', {'asset': 'OIL'}),
    },
)
def asset_layout(asset: str = 'BTC', model_type: str = 'GBM'):
    """Real-time asset price dashboard with model selection.

    Args:
        asset: Asset name (BTC, ETH, AAPL, etc.)
        model_type: 'GBM' (Geometric Brownian Motion) or 'RM' (Random Model/Mean Reversion)
    """
    asset = asset.upper() if asset else 'BTC'
    if asset not in ASSET_CONFIG:
        asset = 'BTC'

    base_price, volatility = ASSET_CONFIG[asset]

    return html.Div([
        # Header
        html.Div([
            html.H3(f'{asset} Price Tracker', style={
                'margin': '0',
                'fontFamily': 'Monaco, "Courier New", monospace',
                'fontSize': '18px',
            }),
            html.Div([
                html.Span(f'Model: {model_type}', style={
                    'marginRight': '16px',
                    'fontSize': '13px',
                    'fontFamily': 'Monaco, "Courier New", monospace',
                }),
                html.Span('LIVE', style={
                    'padding': '4px 8px',
                    'backgroundColor': '#dc3545',
                    'color': 'white',
                    'borderRadius': '4px',
                    'fontSize': '12px',
                    'fontFamily': 'Monaco, "Courier New", monospace',
                    'fontWeight': 'bold',
                }),
            ], style={'display': 'flex', 'alignItems': 'center'}),
        ], style={
            'display': 'flex',
            'justifyContent': 'space-between',
            'alignItems': 'center',
            'padding': '16px',
            'backgroundColor': '#f5f7f8',
            'borderBottom': '1px solid #d5dbdf',
        }),

        # Store data
        dcc.Store(id='asset-name', data=asset),
        dcc.Store(id='asset-model', data=model_type),
        dcc.Store(id='asset-data', data={
            'timestamps': [],
            'prices': [],
            'base_price': base_price,
            'volatility': volatility,
            'current_price': base_price,
        }),

        # Single price chart
        html.Div([
            dcc.Graph(
                id='asset-chart',
                config={'displayModeBar': False},
                style={'height': '100%'},
            ),
        ], style={
            'flex': '1',
            'padding': '16px',
            'overflow': 'hidden',
        }),

        dcc.Interval(id='asset-interval', interval=1000, n_intervals=0),
    ], style={
        'height': '100%',
        'display': 'flex',
        'flexDirection': 'column',
        'backgroundColor': '#ffffff',
    })


# =============================================================================
# IRIS LAYOUT
# =============================================================================

@dash_prism.register_layout(
    id='iris',
    name='Iris Dataset',
    description='Classic machine learning dataset dashboard',
    keywords=['iris', 'dataset', 'machine learning', 'flowers', 'classification'],
    allow_multiple=False,
)
def iris_layout():
    """Iris dataset dashboard."""
    df = px.data.iris()

    scatter_fig = px.scatter(
        df, x='sepal_width', y='sepal_length', color='species', size='petal_length',
        hover_data=['petal_width'], title='Iris Dataset: Sepal Dimensions',
    )
    scatter_fig.update_layout(legend=dict(orientation='h', yanchor='bottom', y=1.02, xanchor='right', x=1))

    box_fig = px.box(df, x='species', y='petal_length', color='species', title='Petal Length by Species')
    box_fig.update_layout(showlegend=False)

    hist_fig = px.histogram(df, x='petal_width', color='species', nbins=20, title='Petal Width Distribution', barmode='overlay', opacity=0.7)

    return html.Div([
        html.Div([
            html.H1('🌸 Iris Dataset Dashboard', style={'margin': '0'}),
            html.P('150 samples of 3 iris species', style={'color': '#666', 'margin': '5px 0 0 0'}),
        ], style={'padding': '20px', 'borderBottom': '1px solid #eee'}),

        html.Div([
            html.Div([dcc.Graph(figure=scatter_fig, style={'height': '400px'}, config={'displayModeBar': False})], style={'flex': '1'}),
            html.Div([dcc.Graph(figure=box_fig, style={'height': '400px'}, config={'displayModeBar': False})], style={'flex': '1'}),
        ], style={'display': 'flex', 'gap': '20px', 'padding': '20px'}),

        html.Div([
            dcc.Graph(figure=hist_fig, style={'height': '300px'}, config={'displayModeBar': False}),
        ], style={'padding': '0 20px 20px 20px'}),
    ], style={'backgroundColor': 'white', 'minHeight': '100%'})


# =============================================================================
# OPTIONS LAYOUT
# =============================================================================

@dash_prism.register_layout(
    id='options',
    name='Options Calculator',
    description='Option pricing and payoff diagrams',
    keywords=['options', 'derivatives', 'finance', 'trading'],
    allow_multiple=True,
    param_options={
        'call': ('Call Option', {'option_type': 'call'}),
        'put': ('Put Option', {'option_type': 'put'}),
    },
)
def options_layout(option_type: str = 'call', strike: float = 100.0):
    """Options calculator with payoff diagram.

    Args:
        option_type: 'call' or 'put'
        strike: Strike price
    """
    import numpy as np
    import plotly.graph_objects as go

    # Price range around strike
    spot_prices = np.linspace(strike * 0.5, strike * 1.5, 100)

    # Calculate payoff
    if option_type == 'call':
        payoffs = np.maximum(spot_prices - strike, 0)
        title = f'Call Option Payoff (Strike: ${strike:.2f})'
        color = '#18bc9c'
    else:  # put
        payoffs = np.maximum(strike - spot_prices, 0)
        title = f'Put Option Payoff (Strike: ${strike:.2f})'
        color = '#e74c3c'

    # Create figure
    fig = go.Figure()

    # Payoff line
    fig.add_trace(go.Scatter(
        x=spot_prices,
        y=payoffs,
        mode='lines',
        name='Payoff',
        line={'color': color, 'width': 3},
        fill='tozeroy',
        fillcolor=f'rgba{tuple(list(int(color.lstrip("#")[i:i+2], 16) for i in (0, 2, 4)) + [0.2])}',
    ))

    # Strike price line
    fig.add_shape(
        type='line',
        x0=strike, x1=strike,
        y0=0, y1=max(payoffs),
        line={'color': '#95a5a6', 'width': 2, 'dash': 'dash'},
        name='Strike',
    )

    # Zero line
    fig.add_shape(
        type='line',
        x0=min(spot_prices), x1=max(spot_prices),
        y0=0, y1=0,
        line={'color': 'rgba(128, 128, 128, 0.3)', 'width': 1},
    )

    # Add annotations
    fig.add_annotation(
        x=strike,
        y=max(payoffs) * 0.95,
        text=f'Strike: ${strike:.2f}',
        showarrow=False,
        font={'family': 'Monaco, "Courier New", monospace', 'size': 12},
        bgcolor='rgba(255, 255, 255, 0.8)',
        bordercolor='#95a5a6',
        borderwidth=1,
    )

    fig.update_layout(
        title={
            'text': title,
            'font': {'family': 'Monaco, "Courier New", monospace', 'size': 18},
        },
        xaxis_title='Spot Price (USD)',
        yaxis_title='Payoff (USD)',
        plot_bgcolor='#ffffff',
        paper_bgcolor='#ffffff',
        font={'family': 'Monaco, "Courier New", monospace'},
        showlegend=False,
        margin={'t': 60, 'r': 20, 'b': 60, 'l': 60},
        hovermode='x unified',
    )

    return html.Div([
        # Header
        html.Div([
            html.H3(f'{option_type.capitalize()} Option', style={
                'margin': '0',
                'fontFamily': 'Monaco, "Courier New", monospace',
                'fontSize': '18px',
            }),
            html.Span(f'Strike: ${strike:.2f}', style={
                'fontSize': '13px',
                'fontFamily': 'Monaco, "Courier New", monospace',
                'color': '#7f8c8d',
            }),
        ], style={
            'display': 'flex',
            'justifyContent': 'space-between',
            'alignItems': 'center',
            'padding': '16px',
            'backgroundColor': '#f5f7f8',
            'borderBottom': '1px solid #d5dbdf',
        }),

        # Payoff diagram
        html.Div([
            dcc.Graph(
                figure=fig,
                config={'displayModeBar': False},
                style={'height': '100%'},
            ),
        ], style={
            'flex': '1',
            'padding': '16px',
        }),

        # Info panel
        html.Div([
            html.Div([
                html.Span('Type:', style={'fontWeight': 'bold'}),
                html.Span(option_type.upper(), style={'marginLeft': '8px'}),
            ], style={
                'display': 'flex',
                'justifyContent': 'space-between',
                'padding': '8px 0',
                'borderBottom': '1px solid #ecf0f1',
                'fontFamily': 'Monaco, "Courier New", monospace',
                'fontSize': '13px',
            }),
            html.Div([
                html.Span('Strike:', style={'fontWeight': 'bold'}),
                html.Span(f'${strike:.2f}', style={'marginLeft': '8px'}),
            ], style={
                'display': 'flex',
                'justifyContent': 'space-between',
                'padding': '8px 0',
                'borderBottom': '1px solid #ecf0f1',
                'fontFamily': 'Monaco, "Courier New", monospace',
                'fontSize': '13px',
            }),
            html.Div([
                html.Span('Max Profit:', style={'fontWeight': 'bold'}),
                html.Span('Unlimited' if option_type == 'call' else f'${strike:.2f}', style={'marginLeft': '8px', 'color': '#27ae60'}),
            ], style={
                'display': 'flex',
                'justifyContent': 'space-between',
                'padding': '8px 0',
                'borderBottom': '1px solid #ecf0f1',
                'fontFamily': 'Monaco, "Courier New", monospace',
                'fontSize': '13px',
            }),
            html.Div([
                html.Span('Max Loss:', style={'fontWeight': 'bold'}),
                html.Span('Premium', style={'marginLeft': '8px', 'color': '#e74c3c'}),
            ], style={
                'display': 'flex',
                'justifyContent': 'space-between',
                'padding': '8px 0',
                'fontFamily': 'Monaco, "Courier New", monospace',
                'fontSize': '13px',
            }),
        ], style={
            'padding': '16px',
            'backgroundColor': '#f5f7f8',
            'borderTop': '1px solid #d5dbdf',
        }),
    ], style={
        'height': '100%',
        'display': 'flex',
        'flexDirection': 'column',
        'backgroundColor': '#ffffff',
    })


# =============================================================================
# COUNTRY LAYOUT
# =============================================================================

@dash_prism.register_layout(
    id='country',
    name='Country Explorer',
    description='Explore data for a specific country and year',
    keywords=['country', 'gapminder', 'gdp', 'population', 'world'],
    allow_multiple=True,
    param_options={
        'usa_2007': ('United States (2007)', {'country': 'United States', 'year': '2007'}),
        'china_2007': ('China (2007)', {'country': 'China', 'year': '2007'}),
        'germany_2007': ('Germany (2007)', {'country': 'Germany', 'year': '2007'}),
        'japan_2007': ('Japan (2007)', {'country': 'Japan', 'year': '2007'}),
        'brazil_2007': ('Brazil (2007)', {'country': 'Brazil', 'year': '2007'}),
        'india_2007': ('India (2007)', {'country': 'India', 'year': '2007'}),
        'uk_2007': ('United Kingdom (2007)', {'country': 'United Kingdom', 'year': '2007'}),
        'france_2007': ('France (2007)', {'country': 'France', 'year': '2007'}),
    },
)
def country_layout(country: str, year: str = '2007'):
    """Country explorer dashboard."""
    df = px.data.gapminder()

    try:
        year_int = int(year)
    except (ValueError, TypeError):
        year_int = 2007

    available_years = sorted(df['year'].unique())
    if year_int not in available_years:
        year_int = available_years[-1]

    # Find country
    matched = country
    for c in df['country'].unique():
        if c.lower() == country.lower():
            matched = c
            break

    country_df = df[df['country'] == matched]

    life_fig = px.line(country_df, x='year', y='lifeExp', title=f'{matched}: Life Expectancy', markers=True)
    life_fig.add_vline(x=year_int, line_dash='dash', line_color='red')

    gdp_fig = px.line(country_df, x='year', y='gdpPercap', title=f'{matched}: GDP per Capita', markers=True)
    gdp_fig.add_vline(x=year_int, line_dash='dash', line_color='red')

    pop_fig = px.area(country_df, x='year', y='pop', title=f'{matched}: Population')
    pop_fig.add_vline(x=year_int, line_dash='dash', line_color='red')

    return html.Div([
        html.Div([
            html.H1(f'🌍 {matched}', style={'margin': '0'}),
            html.P(f'Data for year {year_int}', style={'color': '#666', 'margin': '5px 0 0 0'}),
        ], style={'padding': '20px', 'borderBottom': '1px solid #eee'}),

        html.Div([
            html.Div([dcc.Graph(figure=life_fig, style={'height': '300px'}, config={'displayModeBar': False})], style={'flex': '1'}),
            html.Div([dcc.Graph(figure=gdp_fig, style={'height': '300px'}, config={'displayModeBar': False})], style={'flex': '1'}),
        ], style={'display': 'flex', 'gap': '20px', 'padding': '20px'}),

        html.Div([
            dcc.Graph(figure=pop_fig, style={'height': '250px'}, config={'displayModeBar': False}),
        ], style={'padding': '0 20px 20px 20px'}),
    ], style={'backgroundColor': 'white', 'minHeight': '100%'})


# =============================================================================
# CONTINENT LAYOUT
# =============================================================================

@dash_prism.register_layout(
    id='continent',
    name='Continent Explorer',
    description='Compare data across continents',
    keywords=['continent', 'comparison', 'gapminder', 'world', 'global'],
    allow_multiple=True,
    param_options={
        'all': ('All Continents', {'continents': 'Africa,Americas,Asia,Europe,Oceania'}),
        'europe_asia': ('Europe vs Asia', {'continents': 'Europe,Asia'}),
        'americas': ('Americas', {'continents': 'Americas'}),
        'africa_europe': ('Africa vs Europe', {'continents': 'Africa,Europe'}),
        'asia_oceania': ('Asia vs Oceania', {'continents': 'Asia,Oceania'}),
    },
)
def continent_layout(continents: str = 'Europe,Asia'):
    """Continent comparison dashboard."""
    df = px.data.gapminder()
    latest_year = df['year'].max()
    latest_df = df[df['year'] == latest_year]

    selected = [c.strip() for c in continents.split(',')]
    all_continents = df['continent'].unique().tolist()
    matched = [c for c in all_continents if c in selected or any(s.lower() == c.lower() for s in selected)]
    if not matched:
        matched = ['Europe', 'Asia']

    filtered_df = df[df['continent'].isin(matched)]
    filtered_latest = latest_df[latest_df['continent'].isin(matched)]

    bubble_fig = px.scatter(
        filtered_latest, x='gdpPercap', y='lifeExp', size='pop', color='continent',
        hover_name='country', log_x=True, size_max=60, title=f'GDP vs Life Expectancy ({latest_year})',
    )

    agg = filtered_df.groupby(['continent', 'year']).agg({'lifeExp': 'mean', 'gdpPercap': 'mean'}).reset_index()
    line_fig = px.line(agg, x='year', y='lifeExp', color='continent', title='Life Expectancy Over Time', markers=True)
    gdp_fig = px.line(agg, x='year', y='gdpPercap', color='continent', title='GDP per Capita Over Time', markers=True)

    return html.Div([
        html.Div([
            html.H1(f'🌐 {" vs ".join(matched)}', style={'margin': '0'}),
            html.P('Continent comparison', style={'color': '#666', 'margin': '5px 0 0 0'}),
        ], style={'padding': '20px', 'borderBottom': '1px solid #eee'}),

        html.Div([
            dcc.Graph(figure=bubble_fig, style={'height': '400px'}, config={'displayModeBar': False}),
        ], style={'padding': '20px'}),

        html.Div([
            html.Div([dcc.Graph(figure=line_fig, style={'height': '300px'}, config={'displayModeBar': False})], style={'flex': '1'}),
            html.Div([dcc.Graph(figure=gdp_fig, style={'height': '300px'}, config={'displayModeBar': False})], style={'flex': '1'}),
        ], style={'display': 'flex', 'gap': '20px', 'padding': '0 20px 20px 20px'}),
    ], style={'backgroundColor': 'white', 'minHeight': '100%'})


# =============================================================================
# DELAYED LAYOUT
# =============================================================================

@dash_prism.register_layout(
    id='delayed',
    name='Delayed Layout',
    description='A layout that takes time to load (simulates heavy computation)',
    keywords=['delay', 'loading', 'slow', 'test'],
    allow_multiple=True,
    param_options={
        'quick': ('Quick (1 second)', {'delay': '1'}),
        'medium': ('Medium (3 seconds)', {'delay': '3'}),
        'slow': ('Slow (5 seconds)', {'delay': '5'}),
        'very_slow': ('Very Slow (10 seconds)', {'delay': '10'}),
    },
)
def delayed_layout(delay: str = '3'):
    """Layout that simulates heavy computation."""
    try:
        delay_seconds = min(int(delay), 30)
    except (ValueError, TypeError):
        delay_seconds = 3

    time.sleep(delay_seconds)

    return html.Div([
        html.Div([
            html.H1('⏱️ Delayed Layout', style={'margin': '0 0 10px 0'}),
            html.P(f'This layout took {delay_seconds} seconds to load.', style={'color': '#666'}),
        ], style={'textAlign': 'center', 'padding': '40px'}),

        html.Div([
            html.Div([
                html.H3('✅ Successfully Loaded', style={'color': '#4CAF50'}),
                html.P('The layout has finished loading after the specified delay.'),
            ], style={
                'backgroundColor': '#f0fff0',
                'padding': '20px',
                'borderRadius': '8px',
                'border': '1px solid #4CAF50',
            }),
        ], style={'maxWidth': '600px', 'margin': '0 auto', 'padding': '20px'}),
    ])


# =============================================================================
# CREATE APP
# =============================================================================

app = dash.Dash(__name__, suppress_callback_exceptions=True)

app.layout = html.Div([
    dash_prism.Prism(
        id='prism',
        style={'height': '100vh', 'width': '100%'},
        theme='light',
        size='md',
        actions=[
            dash_prism.Action(id='save', label='Save', icon='Save', tooltip='Save workspace'),
            dash_prism.Action(id='load', label='Load', icon='FolderOpen', tooltip='Load workspace'),
            dash_prism.Action(id='clear', label='Clear', icon='Trash2', tooltip='Clear all tabs'),
        ],
        searchBarPlaceholder='Search layouts...',
        statusBarPosition='bottom',
        persistence=True,
        persistence_type='memory',
        maxTabs=8,
    ),
    dcc.Store(id='saved-workspace', storage_type='memory'),
])


# =============================================================================
# CALLBACKS - Settings
# =============================================================================

@callback(
    Output('prism', 'theme'),
    Output('prism', 'size'),
    Output('settings-status', 'children'),
    Input('settings-apply-btn', 'n_clicks'),
    State('settings-theme', 'value'),
    State('settings-size', 'value'),
    prevent_initial_call=True,
)
def apply_settings(n_clicks, theme, size):
    """Apply theme and size settings."""
    if not n_clicks:
        raise PreventUpdate
    return theme, size, '✓ Applied!'


# =============================================================================
# CALLBACKS - Chat
# =============================================================================

@callback(
    Output({'type': 'chat-messages', 'index': MATCH}, 'children'),
    Output({'type': 'chat-input', 'index': MATCH}, 'value'),
    Input({'type': 'chat-send-btn', 'index': MATCH}, 'n_clicks'),
    Input({'type': 'chat-interval', 'index': MATCH}, 'n_intervals'),
    State({'type': 'chat-input', 'index': MATCH}, 'value'),
    State({'type': 'chat-username', 'index': MATCH}, 'data'),
    prevent_initial_call=True,
)
def update_chat(n_clicks, n_intervals, message_text, username):
    """Handle chat messages."""
    global _chat_messages
    triggered_id = ctx.triggered_id

    if triggered_id and isinstance(triggered_id, dict) and triggered_id.get('type') == 'chat-send-btn':
        if message_text and message_text.strip():
            _chat_messages.append({
                'username': username,
                'text': message_text.strip(),
                'timestamp': datetime.now().isoformat(),
            })
            # Keep last 100 messages
            if len(_chat_messages) > 100:
                _chat_messages = _chat_messages[-100:]

    # Format messages
    if not _chat_messages:
        formatted = '*** No messages yet. Start chatting! ***\n'
    else:
        lines = []
        for msg in _chat_messages:
            ts = msg['timestamp'][:19].replace('T', ' ')
            user = msg['username']
            text = msg['text']
            if user.lower() == 'system':
                lines.append(f'*** {text} ***\n')
            elif user.lower() == username.lower():
                lines.append(f'[{ts}] {user} (you): {text}\n')
            else:
                lines.append(f'[{ts}] <{user}> {text}\n')
        formatted = ''.join(lines)

    clear_input = '' if triggered_id and isinstance(triggered_id, dict) and triggered_id.get('type') == 'chat-send-btn' else (message_text or '')
    return formatted, clear_input


# =============================================================================
# CALLBACKS - Asset
# =============================================================================

@callback(
    Output({'type': 'asset-data', 'index': MATCH}, 'data'),
    Output({'type': 'asset-chart', 'index': MATCH}, 'figure'),
    Input({'type': 'asset-interval', 'index': MATCH}, 'n_intervals'),
    State({'type': 'asset-data', 'index': MATCH}, 'data'),
    State({'type': 'asset-model', 'index': MATCH}, 'data'),
    prevent_initial_call=True,
)
def update_asset_price(n, data, model_type):
    """Update asset price using GBM or RM model."""
    if n is None or not data:
        raise PreventUpdate

    import numpy as np
    from datetime import datetime

    # Extract data
    timestamps = data.get('timestamps', [])
    prices = data.get('prices', [])
    current_price = data.get('current_price', data['base_price'])
    base_price = data['base_price']
    volatility = data['volatility']

    # Generate new price based on model
    dt = 1/252  # Daily time step
    if model_type == 'GBM':
        # Geometric Brownian Motion: dS = mu*S*dt + sigma*S*sqrt(dt)*Z
        mu = 0.0  # Drift
        Z = np.random.normal(0, 1)
        new_price = current_price * (1 + mu * dt + volatility * np.sqrt(dt) * Z)
    else:  # RM (Mean Reversion)
        # Mean reversion: dS = theta*(mean - S)*dt + sigma*S*sqrt(dt)*Z
        theta = 0.1  # Speed of reversion
        Z = np.random.normal(0, 1)
        new_price = current_price + theta * (base_price - current_price) * dt + volatility * current_price * np.sqrt(dt) * Z

    # Ensure price doesn't go negative or too low
    new_price = max(new_price, base_price * 0.3)

    # Update data
    timestamps.append(datetime.now().strftime('%H:%M:%S'))
    prices.append(new_price)

    # Keep last 200 points
    if len(prices) > 200:
        timestamps = timestamps[-200:]
        prices = prices[-200:]

    # Create figure
    fig = {
        'data': [{
            'x': timestamps,
            'y': prices,
            'type': 'scatter',
            'mode': 'lines',
            'line': {'color': '#18bc9c', 'width': 2},
            'fill': 'tozeroy',
            'fillcolor': 'rgba(24, 188, 156, 0.1)',
        }],
        'layout': {
            'title': {
                'text': f'Price: ${new_price:.2f}',
                'font': {'family': 'Monaco, "Courier New", monospace', 'size': 16},
            },
            'xaxis': {
                'title': 'Time',
                'showgrid': True,
                'gridcolor': 'rgba(128, 128, 128, 0.2)',
            },
            'yaxis': {
                'title': 'Price (USD)',
                'showgrid': True,
                'gridcolor': 'rgba(128, 128, 128, 0.2)',
            },
            'plot_bgcolor': '#ffffff',
            'paper_bgcolor': '#ffffff',
            'font': {'family': 'Monaco, "Courier New", monospace'},
            'margin': {'t': 60, 'r': 20, 'b': 60, 'l': 60},
        }
    }

    return {
        'timestamps': timestamps,
        'prices': prices,
        'base_price': base_price,
        'volatility': volatility,
        'current_price': new_price,
    }, fig


# =============================================================================
# CALLBACKS - Workspace Actions
# =============================================================================

@callback(
    Output('prism', 'writeWorkspace'),
    Output('saved-workspace', 'data'),
    Input('prism', 'actionClicked'),
    State('prism', 'readWorkspace'),
    State('saved-workspace', 'data'),
    prevent_initial_call=True,
)
def handle_actions(action_id, current_workspace, saved_workspace):
    """Handle toolbar actions."""
    if action_id == 'save':
        return None, current_workspace
    elif action_id == 'load':
        if saved_workspace:
            return saved_workspace, saved_workspace
        return None, saved_workspace
    elif action_id == 'clear':
        return {
            'version': 1,
            'tabs': [],
            'panels': {'id': 'panel-main'},
            'activeTabs': {},
            'activePanel': 'panel-main',
            'hideSearchbar': False,
            'favoriteLayouts': [],
        }, saved_workspace
    return None, saved_workspace


# =============================================================================
# INITIALIZE
# =============================================================================

dash_prism.init('prism', app)


if __name__ == '__main__':
    print("Dash Prism Demo")
    print("Open http://127.0.0.1:5005 in your browser")
    app.run(debug=True, port=5005, dev_tools_ui=True, dev_tools_props_check=True, dev_tools_serve_dev_bundles=True)

