# Three-year Cycle with one Swap year

I wanted three things with four Households: everyone gives to everyone within a short rotation,
no mutual Pairings, and no Giver repeating a Recipient two years in a row. They can't all hold.
Covering all 12 Pairings in three Loops is impossible for four (the complete directed graph on 4
vertices has no Hamiltonian cycle decomposition; Tillson 1980). Using Loops only, each Loop shares
no Pairing with just one other Loop (its reverse), so a Loop-only schedule must repeat a Pairing
in back-to-back years (at best 3 times per 6 years). Both were checked by brute force.

I chose a three-year Cycle: two Loops and one Swap year. Everyone gives to everyone every three
years and no one repeats a Recipient back to back. The cost is one year in three of two mutual
swaps. The rejected option was a six-year Cycle of all six Loops (never mutual, but repeats).

Consequence: there are only three ways to group four Households around a circle, and under the
no-repeat rule the grouping can only change between two consecutive Swap years. So consecutive
Cycles often reuse a grouping (2029-2031 reshuffle 2026-2028). Forcing rotation was rejected: it
needs back-to-back Swap years and long alternating stretches, which feel less random.
