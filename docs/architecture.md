# Architecture draft

Core grain: Athlete → EventParticipant → Attempt. TestDefinition → TestEvent → EventParticipant. Triathlon attempts may have segments.
Athletes can exist without accounts, including first-time participants added during a test.
Official results derive from valid attempts in published events; PB and all-time rank derive from official results. Times stored as integer hundredths.
Club access, athlete activity and future membership plans are separate concepts.
Publication, revision conflicts, permissions and import idempotency need server enforcement; prototype supplies none of these guarantees.
