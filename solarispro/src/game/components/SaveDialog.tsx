import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  open: boolean;
  defaultName: string;
  quit: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (name: string) => void;
  onQuitNoSave: () => void;
}

export default function SaveDialog({ open, defaultName, quit, onOpenChange, onSave, onQuitNoSave }: Props) {
  const [name, setName] = useState(defaultName);
  useEffect(() => { if (open) setName(defaultName); }, [open, defaultName]);
  const valid = name.trim().length > 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="font-pixel text-sm">{quit ? 'SAVE & QUIT' : 'SAVE GALAXY'}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); if (valid) onSave(name.trim()); }}>
          <Input autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Galaxy name" />
          {!valid && <p className="mt-1 text-xs text-destructive">Give your galaxy a name</p>}
          <DialogFooter className="mt-4 gap-2">
            {quit && <Button type="button" variant="ghost" onClick={onQuitNoSave}>Quit without saving</Button>}
            <Button type="submit" disabled={!valid}>{quit ? 'Save & quit' : 'Save'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}