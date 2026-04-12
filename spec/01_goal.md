# Core Vision
Transform from a simple audio timer into an advanced **Music Practice Intelligence System**.

## System Layers architecture
The system operates sequentially across 5 layers:
1. **Input Layer**: Microphone hardware ingestion of raw audio.
2. **Detection Layer**: Real-time signal processing and thresholding to detect musical events.
3. **Structuring Layer**: Grouping detected events into high-level manual sessions.
4. **Intelligence Layer**: Analyzing metric aggregations (durations, frequency) over time.
5. **Visualization Layer**: Front-end displays for real-time timers and historical analytics.

## Data Flow
`Audio → Detection → NoteEvent → Session → Storage → Analytics → UI`

## Future Extensions (Hooks)
- Automatic Pitch Detection
- Breath Analysis & Support Metrics
- AI-Driven Personal Feedback
