export function Stepper(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  fewer: string;
  more: string;
}) {
  const { label, value, min, max, onChange } = props;
  const slug = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="field">
      <span id={`lbl-${slug}`}>{label}</span>
      <div className="stepper" role="group" aria-labelledby={`lbl-${slug}`}>
        <button
          type="button"
          aria-label={props.fewer}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
        >
          −
        </button>
        <output aria-live="polite" data-testid={`${slug}-value`}>
          {value}
        </output>
        <button
          type="button"
          aria-label={props.more}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}
