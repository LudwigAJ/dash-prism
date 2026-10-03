import { describe, it, expect } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('has the type button unless the caller sets one', () => {
    expect(Button({}).props.type).toBe('button');
    expect(Button({ type: 'submit' }).props.type).toBe('submit');
  });

  it('leaves the type to the child with asChild', () => {
    expect(Button({ asChild: true }).props.type).toBeUndefined();
  });
});
