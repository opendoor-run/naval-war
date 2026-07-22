import { Modal } from './Modal'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-1.5 text-sm font-bold uppercase tracking-wide text-amber-300">{title}</h3>
      <div className="space-y-2 text-sm leading-relaxed text-white/85">{children}</div>
    </section>
  )
}

export function InstructionsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="How to Play" onClose={onClose}>
      <Section title="Objective">
        <p>
          Sink other players' ships to score points. The first player to reach the target score (100 by
          default) wins the game. Each player controls a "task force" of ships; ships you sink go into your
          "Deep Six" pile for points.
        </p>
      </Section>

      <Section title="Setup">
        <p>
          3-9 players. Each player is dealt 5 ship cards (4 in a 9-player game) forming their starting task
          force, and 5 play cards (4 for 9 players) as their starting hand. Aircraft carriers sit at the rear
          of a fleet and can't be targeted until every other ship in that fleet is sunk.
        </p>
        <p>
          Before normal turns begin, there's a one-time "setup phase": starting with the dealer and going
          around the table, each player plays any red special cards from their starting hand they're able to
          (Minefield, Submarine, Torpedo Boat, Additional Ship, Additional Damage), then discards any
          Additional Damage cards they couldn't use, and draws back up to a full hand. Only one Minefield may
          be placed on any single fleet during this phase.
        </p>
      </Section>

      <Section title="Normal turns">
        <p>
          On your turn you draw one card, then either play it, play a different card from your hand, or
          discard a card - that's your whole turn. If the card you draw is a special type (Minefield,
          Submarine, Torpedo Boat, Additional Ship, Additional Damage), it must be resolved immediately as
          both your draw and your play; if there's no legal target for it, it's discarded automatically.
        </p>
      </Section>

      <Section title="Salvo cards">
        <p>
          Each Salvo card shows a gun size and a damage value. You can only fire a Salvo if you own a ship
          with a matching gun size. Damage stacks on the target ship - once total damage meets or exceeds its
          hit points, it sinks and goes to whoever landed the finishing hit.
        </p>
      </Section>

      <Section title="Special cards">
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Minefield</b> - hits every current ship in a fleet, and any ship added to it later, until Minesweeper removes it.</li>
          <li><b>Submarine</b> - roll a die; a 5 or 6 sinks the target ship.</li>
          <li><b>Torpedo Boat</b> - roll a die; only a 6 sinks the target ship.</li>
          <li><b>Additional Damage</b> - adds more hits to a salvo already on an enemy ship; if it finishes the ship off, the sink credit goes to whoever played it, not the original Salvo's owner.</li>
          <li><b>Additional Ship</b> - draw a new ship straight from the harbor pile into your own fleet.</li>
          <li><b>Repair</b> - removes one Salvo (and any Additional Damage on it) from one of your own ships.</li>
          <li><b>Minesweeper</b> - clears every Minefield in front of your own fleet.</li>
          <li><b>Smoke</b> - your fleet is immune to everything except Submarines and Additional Damage, until your next turn.</li>
          <li><b>Destroyer Squadron</b> - a public card anyone may fire Salvos at (4 hits destroys it, immune to everything else). If it survives to your next turn, it attacks once - you pick a target fleet, roll a die, and the number rolled is how many ships you get to sink from it. Either way, it's discarded after.</li>
        </ul>
      </Section>

      <Section title="Airstrikes">
        <p>
          Instead of drawing, a player with an aircraft carrier may launch airstrikes - one strike per carrier
          you own, at the same or different targets, declared all at once. Each strike rolls a die; a 1 sinks
          the target.
        </p>
      </Section>

      <Section title="Elimination & round end">
        <p>
          If every ship in your fleet is sunk, you're eliminated for the round - your remaining hand is
          discarded and you're skipped for the rest of it. The round ends the moment only one player is left,
          or when the draw pile runs out (the player who drew the last card finishes their turn first).
        </p>
      </Section>

      <Section title="Scoring">
        <p>
          Add up the hit-point values of every ship in your Deep Six pile. A lone surviving player gets a +10
          bonus; anyone eliminated during the round loses 10 points (scores can go negative). The next round's
          dealer is whoever has the highest total score. First to the target score wins - if two or more
          players cross it in the same round, whoever has the higher score wins outright, and an exact tie
          means one more round is played.
        </p>
      </Section>

      <Section title="Using this app">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>From the home page, set a target score and max players and click <b>Create a game</b> to get an invite link - send that link to your friends to seat them.</li>
          <li>In the lobby, the host can <b>Start game</b> once at least 3 players have joined, or <b>Delete game</b> to cancel it before it starts.</li>
          <li>
            During setup, play your red cards from your hand (only those are selectable); click <b>Done with
            setup</b> when you're finished to pass to the next player.
          </li>
          <li>
            On your turn: <b>Draw</b> a card, or select a card from your hand to play or discard. Playing a
            card that needs a target opens a picker for the opponent, ship, or Destroyer Squadron to aim at.
          </li>
          <li>If you own a carrier, an <b>Airstrike</b> button lets you declare strikes instead of drawing.</li>
          <li>
            If a Destroyer Squadron of yours survived to your turn, you'll be prompted to resolve its attack
            (pick a target fleet and a priority order of ships) before you can draw or play.
          </li>
          <li>Everything happening in the game - hits, sinkings, eliminations, scoring - shows up in the Log panel on the right, alongside live scores.</li>
          <li>The chat box in the bottom-right corner is for talking with the other players in your game - click its header to collapse or expand it.</li>
          <li>The server enforces every rule (legal targets, gun sizes, turn order, etc.) - if an action isn't allowed, you'll get an error explaining why instead of the game letting you do it.</li>
        </ul>
      </Section>
    </Modal>
  )
}
