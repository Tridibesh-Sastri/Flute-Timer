# Window Behavior Contexts

## Floating Mode Logic
- **Geometry**: Small absolute size scale (approx 300x200).
- **Z-Index**: Rigidly set identically "Always on top".
- **Graphics**: Transparent rendering frame with a completely frameless container.
- **Positioning**: Bound strictly to top-right corner rendering spaces.
- **Recovery**: The Dashboard must be able to reopen or focus the Floating Widget through an explicit launcher action.
- **Opacity**: The widget opacity must be treated as a persisted user preference and applied whenever the widget is created or restored.

## Dashboard Mode Logic
- Expected to behave natively with standard resizable limits supporting graphical analytic overviews.
- Dashboard controls may request Floating Widget focus, widget recreation, or live opacity updates, but must not alter the dashboard window's own opacity.
