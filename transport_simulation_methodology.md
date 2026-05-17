# Mathematical Approach for Public Transport Simulation

This is essentially a **network flow analysis problem** with perturbations (adding/removing lines, changing frequencies). Here's the mathematical framework you can use.

## 1. Network Graph Representation

GTFS data can be represented as a **weighted directed graph**:

```
G = (V, E, W)
```

Where:

- **V** = vertices (stations/stops)
- **E** = edges (connections between stations)
- **W** = weights (travel time, distance, capacity)

```
Station A ---15min---> Station B
    │                        │
    │                        │
   5km                       5km
    │                        │
    v                        v
Station C ---10min---> Station D
```

## 2. Origin-Destination (OD) Flow Model

Your movement data between communes forms an **OD matrix**:

|        | Commune B | Commune C | Commune D |
|--------|----------|----------|----------|
| Commune A |   500    |   200    |   150    |
| Commune B |    0     |   300    |   250    |
| Commune C |   150    |   0      |   100    |

Each cell represents how many people travel from origin to destination.

## 3. Flow Assignment Algorithm

To simulate how people travel, you can use **stochastic user assignment**.

### Step 1: Calculate shortest paths

For each OD pair, compute all possible routes and their total time:

```
Route 1: A → E1 → B (25 min)
Route 2: A → E2 → E3 → B (30 min)
Route 3: A → E4 → B (35 min)
```

### Step 2: Route choice function (Logit)

People choose routes probabilistically based on time:

```
P(route_k) = e^(-β * t_k) / Σ e^(-β * t_j)
```

Where:

- `β` = dispersion parameter (measures variability in choices)
- `t_k` = time of route k

### Step 3: Assign flow

Assign OD matrix flow according to probabilities:

```
Flow on route 1: 500 * 0.6 = 300 persons
Flow on route 2: 500 * 0.3 = 150 persons
Flow on route 3: 500 * 0.1 = 50 persons
```

## 4. Scenario Simulation (Add/Remove Lines)

### Base scenario (current state)

1. Build graph with all lines and frequencies
2. Assign OD flows
3. Store: average times, passengers per line, base emissions

### Modified scenario

1. Modify graph (remove line X, add line Y, change frequency)
2. Recalculate shortest paths
3. Reassign flows
4. Compare metrics

### Example: Removing a metro line

| Metric | Base Scenario | Modified Scenario | Change |
|--------|---------------|---------------------|--------|
| Line 5 Passengers | 50,000/day | 0 | Removed |
| Average Time A→B | 20 min | 45 min | +25 min |
| CO2 Emissions | 200 kg | 350 kg | +75% |
| Reassigned passengers | - | 40,000 to buses | Overload |

**DETECTED IMPACT:**

- 25 min increase in travel time
- 75% increase in emissions
- 40,000 passengers overload buses

## 5. Problem Detection (Critical Impact)

### a) Connection Vulnerability Index

For each OD pair, compute what happens if a line is removed:

```
Vulnerability(A→B) = ΔTime / OriginalTime × 100%
```

| Vulnerability | Classification |
|--------------|----------------|
| > 50% | CRITICAL |
| 25-50% | HIGH |
| 10-25% | MEDIUM |
| < 10% | LOW |

### b) Residual Capacity

After reassigning flow, verify if alternatives can absorb demand:

```
Capacity = LineCapacity - AssignedPassengers

If Capacity < 0 → OVERLOAD
```

### c) System Total Time Impact

```
ΔSystemTime = Σ(Passengers_i × NewTime_i) - Σ(Passengers_i × OriginalTime_i)
```

If `ΔSystemTime` > threshold (e.g., 10,000 extra hours) → Alert

## 6. Carbon Footprint Calculation

### Emission factors by mode

| Transport Mode | Emission Factor (kg CO2/passenger-km) |
|----------------|---------------------------------------|
| Electric metro | 0.028 |
| Diesel bus | 0.089 |
| Electric bus | 0.015 |
| Train | 0.041 |

### Calculation

```
Emissions = Σ(Mode_i × Distance_i × Factor_i)
```

### Scenario comparison

```
- Base: 10,000 kg CO2/day
- With new electric line: 8,500 kg CO2/day
- Reduction: 1,500 kg CO2/day (15%)
```

## 7. Recommended Metrics for Dashboard

| Metric | Formula | Interpretation |
|--------|---------|----------------|
| Average time | Σ(time × passengers) / Σ passengers | Service quality |
| Line occupation | Passengers / Capacity | Efficiency |
| Vulnerability | Δ time per removal | Network robustness |
| CO2 Emissions | Σ(mode × distance × factor) | Environmental impact |
| Alternatives per OD pair | Count paths < 1.5× optimal | Connectivity |
| Passengers without route | OD without available path | Coverage |

## 8. Suggested Implementation

### Data structure

```javascript
Graph = {
  nodes: [id, name, coordinates, type],
  edges: [from, to, mode, distance, time, capacity, frequency],
  od_matrix: {origin: {destination: quantity}},
  lines: {id: [edges], frequency, capacity}
}
```

### Simplified algorithm

1. Parse GTFS → Graph
2. For each OD pair:
   - Dijkstra/A* for paths
   - Compute logit probabilities
   - Assign flow
3. For modified scenario:
   - Modify graph
   - Repeat assignment
   - Compare metrics
4. Generate alerts if thresholds are exceeded

## 9. Recommended Mathematical Tools

| Tool | Application |
|------|-------------|
| Graph theory | Network representation and analysis |
| Dijkstra algorithm | Shortest paths |
| Logit model | Route choice |
| Queueing theory | Capacity and congestion |
| Input-output analysis | Systemic impact |
| Linear optimization | Optimal resource allocation |

## Simulation Flow Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    GTFS DATA                               │
│   (schedules, routes, stops, frequencies, connections)     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              GRAPH CONSTRUCTION                            │
│   Nodes = Stations, Edges = Connections with weights        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│           OD FLOW ASSIGNMENT                               │
│   Shortest paths + Logit Model → Passenger distribution     │
└─────────────────────┬───────────────────────────────────────┘
                      │
           ┌─────────┴─────────┐
           ▼                   ▼
    ┌──────────────┐    ┌──────────────┐
    │    BASE      │    │   MODIFIED    │
    │  SCENARIO    │    │   SCENARIO    │
    │  (current)   │    │ (±line, ±freq)│
    └──────┬───────┘    └──────┬───────┘
           │                   │
           └─────────┬─────────┘
                     ▼
         ┌───────────────────────┐
         │     COMPARISON        │
         │  - Time               │
         │  - Capacity           │
         │  - CO2 Emissions      │
         │  - Vulnerability      │
         └───────────────────────┘
```

## Next Steps

When you're ready to implement:

1. **Phase 1**: Parse GTFS data and build base graph
2. **Phase 2**: Implement shortest path algorithm (Dijkstra)
3. **Phase 3**: Implement flow assignment model
4. **Phase 4**: Create scenario modification interface
5. **Phase 5**: Implement emissions calculation and alerts

---

*Document prepared for the public transport simulation hackaton.*
