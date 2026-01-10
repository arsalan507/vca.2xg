# Admin Dashboard File Approval Update

## Instructions

After running the SQL (`add-file-approval-system.sql`), you need to update the AdminDashboard to add the UI for approving/rejecting files.

## Steps:

### 1. Run SQL First
Run `add-file-approval-system.sql` in Supabase SQL Editor

### 2. Add Mutations (after line 352 in AdminDashboard.tsx)

Add these two mutations after `updateProductionStageMutation`:

```typescript
  // Approve file mutation
  const approveFileMutation = useMutation({
    mutationFn: ({ fileId, notes }: { fileId: string; notes?: string }) =>
      productionFilesService.approveFile(fileId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-files', selectedAnalysis?.id] });
      toast.success('File approved successfully!');
    },
    onError: () => {
      toast.error('Failed to approve file');
    },
  });

  // Reject file mutation
  const rejectFileMutation = useMutation({
    mutationFn: ({ fileId, notes }: { fileId: string; notes: string }) =>
      productionFilesService.rejectFile(fileId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-files', selectedAnalysis?.id] });
      toast.success('File rejected');
    },
    onError: () => {
      toast.error('Failed to reject file');
    },
  });
```

### 3. Add Handler Functions (after closeAssignModal)

Add these handler functions:

```typescript
  const handleApproveFile = (fileId: string) => {
    const notes = prompt('Add approval notes (optional):');
    approveFileMutation.mutate({ fileId, notes: notes || undefined });
  };

  const handleRejectFile = (fileId: string) => {
    const notes = prompt('Why are you rejecting this file? (required)');
    if (!notes || notes.trim() === '') {
      toast.error('Rejection reason is required');
      return;
    }
    rejectFileMutation.mutate({ fileId, notes });
  };
```

### 4. Replace the File Display Section (around line 961-993)

Replace the production files display section with the updated version that includes approval buttons.

See the complete updated section in the code file I'm creating...

