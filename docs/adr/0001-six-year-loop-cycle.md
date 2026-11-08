# Six-year Cycle of Loops (no mutual Pairings)

Status: accepted 2026-11-08, replacing the earlier three-year Cycle with a Swap year.

With four Households I wanted: no two Households giving to each other, everyone giving to
everyone over time, and no Giver repeating a Recipient two years in a row. All three can't hold.
A three-year rotation needs a Swap year (the 12 Giver → Recipient Pairings can't be split into three
Loops for four vertices; Tillson 1980), and a Loop-only schedule must repeat some Pairings in
back-to-back years, because each Loop shares no Pairing only with its own reverse. Both were checked
by brute force over every order.

I chose no mutual Pairings ever (that mattered most to me). The Cycle is six years using all six
Loops once, in the order with the fewest back-to-back repeats: three per Cycle, each on a different
Giver, none at the Cycle boundary. Every Giver has every other Household within at most five years
and exactly twice per Cycle. A seeded shuffle per Cycle assigns Households to slots, so which
Households get the repeats changes from Cycle to Cycle.

Rejected: a three-year Cycle with one Swap year (first version; mutual swaps felt wrong), and a
forced rotation of groupings (needs long alternating stretches).
