import { Announcer, ToastHost } from './components/Feedback';
import { Help } from './components/Help';
import { ItemList } from './components/ItemList';
import { LibraryMenu } from './components/LibraryMenu';
import { Logo, PieceTitle } from './components/PieceTitle';
import { ModulationDialog } from './components/ModulationDialog';
import { VoltaDialog } from './components/VoltaDialog';
import { MarkDialog } from './components/MarkDialog';
import { TempoDialog } from './components/TempoDialog';
import { ZoomHud } from './components/ZoomControl';
import { Options } from './components/Options';
import { SelectionBar } from './components/SelectionBar';
import { Status } from './components/Status';
import { DOCKED, useMedia } from './components/useMedia';
import { ThemeToggle, useApplyTheme } from './components/ThemeToggle';
import { Toolbar } from './components/Toolbar';
import { Dock } from './components/Transport';
import { useKeyboard } from './components/useKeyboard';
import { Score } from './score/Score';
import { Stage, StageButton } from './components/Stage';
import { useUiStore } from './state/store';

export function App() {
  useKeyboard();
  useApplyTheme();
  // phones and tablets dock the selection bar above the number pad, by the thumb (see Dock)
  const docked = useMedia(DOCKED);
  const stage = useUiStore((s) => s.stage);
  if (stage)
    return (
      <>
        <Stage />
        <Announcer />
        <ZoomHud />
      </>
    );
  return (
    <>
      <main className="wrap">
        <header className="app-header">
          <div className="brand">
            <Logo />
            <h1>Time Sculpture</h1>
          </div>
          <PieceTitle />
          <div className="header-actions">
            <StageButton />
            <ThemeToggle />
            <LibraryMenu />
          </div>
        </header>

        <section className="panel" aria-label="Score">
          <Toolbar />
          <Score />
          <ItemList />
          {!docked && <SelectionBar />}
          <Status />
        </section>

        <Options />
        <Help />
      </main>
      <Dock />
      <ToastHost />
      <Announcer />
      <ModulationDialog />
      <VoltaDialog />
      <MarkDialog />
      <TempoDialog />
      <ZoomHud />
    </>
  );
}
