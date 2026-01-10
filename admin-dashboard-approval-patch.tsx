// ===== ADD THESE MUTATIONS AFTER LINE 352 (after updateProductionStageMutation) =====

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

// ===== ADD THESE HANDLERS AFTER closeAssignModal (around line 400) =====

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

// ===== REPLACE THE FILE DISPLAY SECTION (around line 961-993) =====
// Replace from {productionFiles.map((file: ProductionFile) => (
// to the closing )))} with this:

                                {productionFiles.map((file: ProductionFile) => (
                                  <div key={file.id} className={`p-3 rounded-lg border-2 ${
                                    file.approval_status === 'approved' ? 'bg-green-50 border-green-200' :
                                    file.approval_status === 'rejected' ? 'bg-red-50 border-red-200' :
                                    'bg-gray-50 border-gray-200'
                                  }`}>
                                    <div className="flex items-start justify-between space-x-3">
                                      <div className="flex items-start space-x-3 flex-1 min-w-0">
                                        <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                          <FilmIcon className="w-4 h-4 text-primary-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center flex-wrap gap-2 mb-1">
                                            <p className="text-sm font-medium text-gray-900 truncate">{file.file_name}</p>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getFileTypeBadge(file.file_type)}`}>
                                              {file.file_type.replace(/_/g, ' ')}
                                            </span>
                                            {file.approval_status === 'approved' && (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                <CheckCircleIcon className="w-3 h-3 mr-1" />
                                                Approved
                                              </span>
                                            )}
                                            {file.approval_status === 'rejected' && (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                <XCircleIcon className="w-3 h-3 mr-1" />
                                                Rejected
                                              </span>
                                            )}
                                            {file.approval_status === 'pending' && (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                <ClockIcon className="w-3 h-3 mr-1" />
                                                Pending Review
                                              </span>
                                            )}
                                          </div>
                                          {file.description && (
                                            <p className="text-xs text-gray-600 mt-0.5">{file.description}</p>
                                          )}
                                          <p className="text-xs text-gray-500 mt-0.5">
                                            By {file.uploader?.full_name || file.uploader?.email || 'Unknown'} • {new Date(file.created_at).toLocaleDateString()}
                                          </p>
                                          {file.review_notes && (
                                            <div className="mt-2 bg-white bg-opacity-60 p-2 rounded text-xs">
                                              <p className="font-medium text-gray-700">Review Notes:</p>
                                              <p className="text-gray-600 mt-0.5">{file.review_notes}</p>
                                              {file.reviewer && (
                                                <p className="text-gray-500 mt-1">
                                                  — {file.reviewer.full_name || file.reviewer.email}
                                                </p>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex flex-col space-y-2 flex-shrink-0">
                                        <a
                                          href={file.file_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center justify-center px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium whitespace-nowrap"
                                        >
                                          <ArrowDownTrayIcon className="w-4 h-4 mr-1" />
                                          View
                                        </a>
                                        {file.approval_status !== 'approved' && (
                                          <button
                                            onClick={() => handleApproveFile(file.id)}
                                            disabled={approveFileMutation.isPending}
                                            className="inline-flex items-center justify-center px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50 whitespace-nowrap"
                                          >
                                            <CheckCircleIcon className="w-4 h-4 mr-1" />
                                            Approve
                                          </button>
                                        )}
                                        {file.approval_status !== 'rejected' && (
                                          <button
                                            onClick={() => handleRejectFile(file.id)}
                                            disabled={rejectFileMutation.isPending}
                                            className="inline-flex items-center justify-center px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50 whitespace-nowrap"
                                          >
                                            <XCircleIcon className="w-4 h-4 mr-1" />
                                            Reject
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
