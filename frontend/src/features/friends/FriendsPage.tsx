import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { PageHeader } from '../../components/PageHeader'
import { Section, SoonTag } from '../../components/Section'
import { TextField } from '../../components/TextField'
import styles from './FriendsPage.module.css'

// Placeholder. Layout matches the finished feature; data comes from the
// `friendships` and `game_invites` tables once it is wired up.
export function FriendsPage() {
  return (
    <>
      <PageHeader title="Friends">Play with people you know.</PageHeader>

      <div className={styles.layout}>
        <div>
          <Section title="Your friends">
            <EmptyState title="No friends yet">
              Add someone by username, then invite them to any game.
            </EmptyState>
          </Section>
        </div>

        <div>
          <Section title="Add a friend" aside={<SoonTag />}>
            <form className={styles.add} onSubmit={(e) => e.preventDefault()}>
              <TextField label="Username" placeholder="their_username" disabled autoComplete="off" />
              <Button type="submit" variant="secondary" disabled>
                Send request
              </Button>
            </form>
          </Section>

          <Section title="Requests">
            <EmptyState title="Nothing waiting" />
          </Section>
        </div>
      </div>
    </>
  )
}
