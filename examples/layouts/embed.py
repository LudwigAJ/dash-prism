"""The embed layout, which shows the web page at a URL parameter in an iframe."""

from __future__ import annotations

from dash import html

import dash_prism


@dash_prism.register_layout(
    id="embed",
    name="Embed URL",
    description="Embed a website in an iframe",
    keywords=["iframe", "embed", "url", "web", "website"],
    allow_multiple=True,
)
def embed_layout(url: str = "https://example.com") -> html.Div:
    """Return an iframe that shows a web page.

    :param url: The URL of the page.
    """
    if not url:
        return html.Div(
            html.P("No URL provided.", className="demo-error"),
            className="demo-page demo-centered",
        )
    return html.Div(
        html.Iframe(src=url, title="Embedded URL", className="demo-frame"), className="demo-page"
    )
