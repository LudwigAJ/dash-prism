"""The OHLC layout, a random candlestick chart that opens in many tabs."""

from __future__ import annotations

import datetime
import random

import plotly.graph_objects as go
from dash import html

import dash_prism
from examples import theme

_TICKERS = [
    "ALPHA-X",
    "BETA-Q",
    "GAMMA-Z",
    "DELTA-V",
    "OMEGA-K",
    "SIGMA-J",
    "THETA-W",
    "ZETA-Y",
    "KAPPA-M",
    "LAMBDA-N",
]
_FIRST_DAY = datetime.date(2024, 1, 1)


def _random_prices(n_periods: int) -> dict[str, list[float]]:
    """Return random daily prices.

    :param n_periods: The number of days.
    :returns: The lists ``"open"``, ``"high"``, ``"low"`` and ``"close"``, one value per day.
    """
    prices: dict[str, list[float]] = {"open": [], "high": [], "low": [], "close": []}
    close_price = random.uniform(100, 200)
    for _ in range(n_periods):
        open_price = close_price
        close_price = open_price * (1 + random.gauss(0, 0.02))
        high_price = max(open_price, close_price) * (1 + abs(random.gauss(0, 0.01)))
        low_price = min(open_price, close_price) * (1 - abs(random.gauss(0, 0.01)))
        prices["open"].append(round(open_price, 2))
        prices["high"].append(round(high_price, 2))
        prices["low"].append(round(low_price, 2))
        prices["close"].append(round(close_price, 2))
    return prices


@dash_prism.register_layout(
    id="ohlc",
    name="OHLC Chart",
    description="Candlestick Open-High-Low-Close chart with random data",
    keywords=["ohlc", "candlestick", "trading", "finance", "stocks", "market"],
    allow_multiple=True,
)
def ohlc_layout() -> html.Div:
    """Return a candlestick chart of random prices for a random ticker."""
    n_periods = 60
    prices = _random_prices(n_periods)
    fig = go.Figure(
        go.Candlestick(
            x=[_FIRST_DAY + datetime.timedelta(days=i) for i in range(n_periods)],
            open=prices["open"],
            high=prices["high"],
            low=prices["low"],
            close=prices["close"],
            increasing={"line_color": theme.POSITIVE, "fillcolor": theme.POSITIVE},
            decreasing={"line_color": theme.NEGATIVE, "fillcolor": theme.NEGATIVE},
        )
    )
    fig.update_layout(
        title={"text": random.choice(_TICKERS), "font": {"size": 14}},
        xaxis_title="Date",
        yaxis_title="Price ($)",
        xaxis_rangeslider_visible=False,
        showlegend=False,
    )
    return html.Div(theme.graph_panel(fig), className="demo-page")
