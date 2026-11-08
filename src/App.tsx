import { Announcer, ToastHost } from './components/Feedback';
import { Help } from './components/Help';
import { ItemList } from './components/ItemList';
import { LibraryMenu } from './components/LibraryMenu';
import { Options } from './components/Options';
import { SelectionBar } from './components/SelectionBar';
import { Status } from './components/Status';
import { ThemeToggle, useApplyTheme } from './components/ThemeToggle';
import { Toolbar } from './components/Toolbar';
import { Dock } from './components/Transport';
import { useKeyboard } from './components/useKeyboard';
import { Score } from './score/Score';

export function App() {
  useKeyboard();
  useApplyTheme();
  return (
    <>
      <main className="wrap">
        <header className="app-header">
          <div className="title-row">
            <h1>Time Sculpture</h1>
            <div className="header-actions">
              <ThemeToggle />
              <LibraryMenu />
            </div>
          </div>
          <p>
            Plan a phrase from both ends, leave silence and open space, and shape it by hand. The
            ending is anchored, so it always lands on 1.
          </p>
        </header>

        <section className="panel" aria-label="Score">
          <Toolbar />
          <Score />
          <ItemList />
          <SelectionBar />
          <Status />
        </section>

        <Options />
        <Help />
      </main>
      <Dock />
      <ToastHost />
      <Announcer />
    </>
  );
}
