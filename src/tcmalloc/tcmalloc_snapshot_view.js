// Copyright (c) 2013 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

base.requireStylesheet('tcmalloc.tcmalloc_snapshot_view');

base.require('tracing.analysis.object_snapshot_view');
base.require('tracing.analysis.util');

base.exportTo('tcmalloc', function() {

  var tsRound = tracing.analysis.tsRound;

  /*
   * Displays a heap memory snapshot in a human readable form.
   * @constructor
   */
  var TcmallocSnapshotView = ui.define(
      'heap-snapshot-view',
      tracing.analysis.ObjectSnapshotView);

  TcmallocSnapshotView.prototype = {
    __proto__: tracing.analysis.ObjectSnapshotView.prototype,

    decorate: function() {
      this.classList.add('tcmalloc-snapshot-view');
    },

    updateContents: function() {
      var snapshot = this.objectSnapshot_;
      if (!snapshot || !snapshot.heap_) {
        this.textContent = 'No heap found.';
        return;
      }
      // Clear old snapshot view.
      this.textContent = '';

      // Note: "total" may actually be less than the largest allocation bin.
      // This might happen if one stack is doing a lot of allocation, then
      // passing off to another stack for deallocation.  That stack will
      // have a high "current bytes" count and the other one might be
      // negative or zero. So "total" may be smaller than the largest trace.
      var subhead = document.createElement('div');
      subhead.textContent = 'Retaining ' +
          this.getByteString_(snapshot.total_.currentBytes) + ' in ' +
          snapshot.total_.currentAllocs +
          ' allocations. Showing > 0.1 MB.';
      subhead.className = 'subhead';
      this.appendChild(subhead);

      // Build a nested tree-view of allocations
      var myList = this.buildAllocList_(snapshot.heap_, false);
      this.appendChild(myList);
    },

    /**
     * Creates a nested list with clickable entries.
     * @param {Object} heapEntry The current trace heap entry.
     * @param {boolean} hide Whether this list is hidden by default.
     * @return {Element} A <ul> list element.
     */
    buildAllocList_: function(heapEntry, hide) {
      var myList = document.createElement('ul');
      myList.hidden = hide;
      var keys = Object.keys(heapEntry.children);
      keys.sort(function(a, b) {
        // Sort from large to small.
        return heapEntry.children[b].currentBytes -
            heapEntry.children[a].currentBytes;
      });
      for (var i = 0; i < keys.length; i++) {
        var traceName = keys[i];
        var trace = heapEntry.children[traceName];
        // Don't show small nodes - they make things harder to see.
        if (trace.currentBytes < 100 * 1024)
          continue;
        var myItem =
            this.buildItem_(traceName, trace.currentBytes, trace.currentAllocs);
        myList.appendChild(myItem);
        // Build a nested <ul> list of my children.
        if (Object.keys(trace.children).length > 0)
          myItem.appendChild(this.buildAllocList_(trace, true));
      }
      return myList;
    },

    /*
     * Returns a <li> for an allocation traceName of size bytes.
     */
    buildItem_: function(traceName, bytes, allocs) {
      var myItem = document.createElement('li');
      myItem.addEventListener('click', function(event) {
        // Allow click on the +/- image (li) or child divs.
        if (this == event.target || this == event.target.parentElement) {
          this.classList.toggle('expanded');
          var child = this.querySelector('ul');
          child.hidden = !child.hidden;
        }
      });
      myItem.classList.add('collapsed');
      // The empty trace name indicates that the allocations occurred at
      // this trace level, not in a sub-trace. This looks weird as the
      // empty string, so replace it with something non-empty and don't give
      // that line an expander.
      if (traceName.length == 0)
        traceName = '(here)';
      var byteDiv = document.createElement('div');
      byteDiv.textContent = this.getByteString_(bytes);
      byteDiv.className = 'trace-bytes';
      myItem.appendChild(byteDiv);

      if (traceName.length == 0) {
        // The empty trace name indicates that the allocations occurred at
        // this trace level, not in a sub-trace. This looks weird as the
        // empty string, so replace it with something non-empty and don't
        // give that line an expander.
        traceName = '(here)';
      } else if (traceName.indexOf('..') == 0) {
        // Tasks in RunTask have special handling. They show the path of the
        // filename. Convert '../../foo.cc' into 'RunTask from foo.cc'.
        var lastSlash = traceName.lastIndexOf('/');
        if (lastSlash != -1)
          traceName = 'Task from ' + traceName.substr(lastSlash + 1);
      }
      var traceDiv = document.createElement('div');
      traceDiv.textContent = traceName;
      traceDiv.className = 'trace-name';
      myItem.appendChild(traceDiv);

      return myItem;
    },

    /*
     * Returns a human readable string for a size in bytes.
     */
    getByteString_: function(bytes) {
      var mb = bytes / 1024 / 1024;
      return mb.toFixed(1) + ' MB';
    }
  };

  tracing.analysis.ObjectSnapshotView.register(
      'memory::Heap', TcmallocSnapshotView);

  return {
    TcmallocSnapshotView: TcmallocSnapshotView
  };

});