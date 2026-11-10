import { PageHeader } from '../../components/PageHeader'
import { groupByCategory } from '../../games/catalog'
import { GameCard } from './GameCard'
import styles from './GamesPage.module.css'

export function GamesPage() {
  const groups = groupByCategory()

  return (
    <>
      <PageHeader title="Games">Pick a table. Invite friends when you’re ready.</PageHeader>
      <div className={styles.groups}>
        {groups.map((group) => (
          <section key={group.id} aria-labelledby={`group-${group.id}`}>
            <h2 id={`group-${group.id}`} className={styles.groupTitle}>
              {group.label}
            </h2>
            <ul className={styles.grid}>
              {group.games.map((game) => (
                <li key={game.id}>
                  <GameCard game={game} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}
