(*
    JSYNC Backup Tool v1.1.5
    Created by: Jesse Morley
    Last updated: 21 October 2024
    
    Description: 
    Automates the rsync backup process for the active Capture One session. 
    Prompts user to select backup location or uses stored backup location.
    Provides progress notifications, including a summary on successful backup.
*)

-- Constants for paths and filenames
set backupDirectory to (POSIX path of (path to library folder from user domain)) & "Application Support/CaptureOneBackup/"
set backupLocationFile to backupDirectory & ".lastBackupLocation.txt"

-- Ensure the directory exists
do shell script "mkdir -p " & quoted form of backupDirectory


-- Initialize the backup folder
set destinationFolder to ""

-- Check if there is a previously saved backup location
set fileExists to (do shell script "test -f " & quoted form of backupLocationFile & " && echo 1 || echo 0")

if fileExists is "1" then
	-- Read the last saved backup location
	set destinationFolder to do shell script "cat " & quoted form of backupLocationFile
end if

-- Get the current Capture Session folder
set sessionFolder to getCurrentCaptureSessionFolder()

-- Ensure a valid session folder was found
if sessionFolder is "" then
	return -- Exit the script if no valid session folder was found
end if

-- Prompt the user to choose an action
try
	if destinationFolder is missing value or destinationFolder is "" then
		set destinationFolder to "No backup location selected."
	end if
	
	-- Custom dialog with options for the user
	set userChoice to button returned of (display alert "JSYNC Backup" message "Current backup directory:" & return & destinationFolder & " " buttons {"Run Backup", "Choose Location", "Cancel"} default button "Run Backup" as informational giving up after 30)
on error number -128 -- User pressed Cancel
	return -- Exit the script silently
end try

-- Handle user choices for backup location or running the backup
if userChoice is "Choose Location" then
	try
		-- Ask the user to select a destination folder
		set destinationFolder to chooseFolderDialog()
		if destinationFolder is not "" then
			-- Save the selected location
			do shell script "echo " & quoted form of destinationFolder & " > " & quoted form of backupLocationFile
			
			-- Ask to start backup immediately after selection
			set backupNowChoice to button returned of (display alert "Location set" message "Would you like to back up now?" buttons {"Back Up", "Cancel"} default button "Back Up")
			
			if backupNowChoice is "Back Up" then
				-- Proceed with the backup
				set userChoice to "Run Backup"
			else
				return -- Exit if "Cancel" is selected
			end if
		else
			return -- Exit if the folder selection is cancelled
		end if
	on error number -128
		return -- Exit the script silently if "Cancel" is pressed
	end try
end if

-- Perform the rsync backup if "Run Backup" was selected
if userChoice is "Run Backup" then
	-- Set the temp file path to Desktop for easy access during debugging
	set tempFile to POSIX path of (path to desktop folder) & "rsync_output_clean.txt"
	
	-- Run backup with progress notifications
	set backupSuccess to performBackupWithProgress(sessionFolder, destinationFolder, tempFile)
	
	if not backupSuccess then
		return -- Exit on backup failure
	end if
	
	-- Optionally, delete the temporary file after processing
	do shell script "rm " & quoted form of tempFile & " 2>/dev/null || true"
end if

-- Function to format file size based on the thresholds
on formatFileSize(fileSizeInBytes)
	try
		set fileSizeInBytes to fileSizeInBytes as number
	on error
		display dialog "Invalid file size: " & fileSizeInBytes buttons {"OK"} default button "OK"
		return "Unknown size"
	end try
	
	if fileSizeInBytes ≥ 1.0E+9 then
		set formattedSize to (fileSizeInBytes / 1.0E+9)
		set formattedSize to (round (formattedSize * 100)) / 100.0
		return formattedSize & " GB"
	else if fileSizeInBytes ≥ 1000000 then
		set formattedSize to round (fileSizeInBytes / 1000000) rounding to nearest
		return formattedSize & " MB"
	else
		set formattedSize to round (fileSizeInBytes / 1000) rounding to nearest
		return formattedSize & " KB"
	end if
end formatFileSize

-- Function to perform backup with periodic progress notifications
on performBackupWithProgress(sessionFolder, destinationFolder, tempFile)
	
	-- Step 1: Pre-scan to estimate total files
	display notification "Scanning files..." with title "JSYNC Backup" subtitle "Preparing backup..."
	
	set estimateCommand to "find " & quoted form of sessionFolder & " -type f | wc -l"
	set totalFiles to 0
	try
		set totalFiles to (do shell script estimateCommand) as integer
	on error
		set totalFiles to 0
	end try
	
	-- Step 2: Start rsync with progress flag in background
	set rsyncCommand to "rsync -av --delete --progress --stats " & quoted form of sessionFolder & " " & quoted form of destinationFolder & "/ > " & quoted form of tempFile & " 2>&1 &"
	
	try
		do shell script rsyncCommand
	on error errMsg number errNum
		-- Check if the error is due to "No space left on device"
		if errNum is 28 or errMsg contains "No space left on device" then
			display alert "Backup Failed" message "Not enough space on the destination." as critical buttons {"OK"} default button "OK"
		else
			-- Handle other rsync errors
			display alert "Backup Failed" message errMsg as critical buttons {"OK"} default button "OK"
		end if
		return false -- Exit on error
	end try
	
	-- Step 3: Monitor progress with periodic notifications
	set startTime to current date
	set lastNotificationTime to startTime
	
	repeat
		delay 3 -- Check every 3 seconds
		
		-- Check if rsync is still running
		set rsyncRunning to false
		try
			do shell script "pgrep -f 'rsync.*" & sessionFolder & "'"
			set rsyncRunning to true
		on error
			-- rsync finished
			exit repeat
		end try
		
		-- Get current progress
		set currentProgress to parseProgress(tempFile, totalFiles)
		set filesProcessed to item 1 of currentProgress
		set currentFile to item 2 of currentProgress
		set transferRate to item 3 of currentProgress
		set progressPercent to item 4 of currentProgress
		
		-- Send notification every 10 seconds or on significant progress
		set currentTime to current date
		set timeSinceLastNotification to (currentTime - lastNotificationTime)
		
		if timeSinceLastNotification >= 10 or progressPercent mod 25 = 0 then
			set progressMessage to "Progress: " & progressPercent & "%"
			if totalFiles > 0 then
				set progressMessage to progressMessage & " (" & filesProcessed & " of " & totalFiles & " files)"
			end if
			
			set subtitleMessage to ""
			if transferRate is not "" then
				set subtitleMessage to "Speed: " & transferRate
			end if
			if currentFile is not "" then
				if subtitleMessage is not "" then
					set subtitleMessage to subtitleMessage & " • " & currentFile
				else
					set subtitleMessage to currentFile
				end if
			end if
			
			display notification progressMessage with title "JSYNC Backup" subtitle subtitleMessage
			set lastNotificationTime to currentTime
		end if
		
	end repeat
	
	-- Parse final results
	set finalResults to parseFinalResults(tempFile)
	set numFilesTransferred to item 1 of finalResults
	set totalSizeTransferred to item 2 of finalResults
	set totalBackupSize to item 3 of finalResults
	
	-- Format sizes
	set formattedTransferSize to formatFileSize(totalSizeTransferred)
	set formattedTotalSize to formatFileSize(totalBackupSize)
	
	-- Final success notification
	if numFilesTransferred = "0" then
		set finalMessage to "Backup complete - No new files"
		set finalSubtitle to "Total backup size: " & formattedTotalSize
	else
		set finalMessage to "Backup complete - " & numFilesTransferred & " files copied"
		set finalSubtitle to "Transferred: " & formattedTransferSize & " • Total: " & formattedTotalSize
	end if
	
	display notification finalMessage with title "JSYNC Backup" subtitle finalSubtitle sound name "Glass"
	
	return true
	
end performBackupWithProgress

-- Function to parse current progress from rsync output
on parseProgress(tempFile, totalFiles)
	set filesProcessed to 0
	set currentFile to ""
	set transferRate to ""
	set progressPercent to 0
	
	try
		-- Get recent output (last 10 lines)
		set recentOutput to do shell script "tail -10 " & quoted form of tempFile & " 2>/dev/null || echo ''"
		
		-- Parse files processed from "to-check" info
		try
			set checkInfo to do shell script "echo " & quoted form of recentOutput & " | grep -o 'to-check=[0-9]*/[0-9]*' | tail -1"
			if checkInfo is not "" then
				set remainingFiles to (do shell script "echo " & quoted form of checkInfo & " | cut -d'=' -f2 | cut -d'/' -f1") as integer
				set totalFoundFiles to (do shell script "echo " & quoted form of checkInfo & " | cut -d'=' -f2 | cut -d'/' -f2") as integer
				set filesProcessed to totalFoundFiles - remainingFiles
			end if
		end try
		
		-- Parse current file being transferred  
		try
			set currentFile to do shell script "echo " & quoted form of recentOutput & " | grep -E '^[^/]*/' | tail -1 | sed 's/^[ \\t]*//'"
			if length of currentFile > 40 then
				set currentFile to "..." & (text -37 thru -1 of currentFile)
			end if
		end try
		
		-- Parse transfer rate
		try
			set transferRate to do shell script "echo " & quoted form of recentOutput & " | grep -o '[0-9.]*[KMG]B/s' | tail -1"
		end try
		
		-- Calculate percentage
		if totalFiles > 0 and filesProcessed > 0 then
			set progressPercent to round ((filesProcessed / totalFiles) * 100)
			if progressPercent > 100 then set progressPercent to 100
		end if
		
	on error
		-- Keep defaults on error
	end try
	
	return {filesProcessed, currentFile, transferRate, progressPercent}
end parseProgress

-- Function to parse final results
on parseFinalResults(tempFile)
	set numFilesTransferred to "0"
	set totalSizeTransferred to "0"
	set totalBackupSize to "0"
	
	try
		set numFilesTransferred to do shell script "awk '/Number of files transferred:/ {print $NF}' " & quoted form of tempFile & " | grep -Eo '[0-9]+' | head -1 || echo '0'"
		set totalSizeTransferred to do shell script "awk '/Total transferred file size:/ {print $(NF-1)}' " & quoted form of tempFile & " | tr -d '[:space:]' || echo '0'"
		set totalBackupSize to do shell script "awk '/Total file size:/ {print $(NF-1)}' " & quoted form of tempFile & " | tr -d '[:space:]' || echo '0'"
	end try
	
	return {numFilesTransferred, totalSizeTransferred, totalBackupSize}
end parseFinalResults


-- Function: Get the current Capture One session folder
on getCurrentCaptureSessionFolder()
	try
		tell front document of application "Capture One"
			set sessionDir to get (path as text) -- Get the full path of the session
			set sessionName to get (name as text) -- Get the session name
			
			-- Remove ".cosessiondb" extension if present
			if sessionName ends with ".cosessiondb" then
				set sessionName to text 1 thru -13 of sessionName
			end if
			
			set sessionPath to POSIX path of sessionDir
			
			-- Ensure the path ends with a "/"
			if sessionPath does not end with "/" then
				set sessionPath to sessionPath & "/"
			end if
			
			-- Construct the full session folder path
			set sessionFolder to sessionPath & sessionName
			
			-- Check if the folder exists
			set folderExists to (do shell script "test -d " & quoted form of sessionFolder & " && echo 1 || echo 0")
			
			if folderExists is "0" then
				display dialog "Session and session folder names do not match. Close Capture One and rename the parent folder to " & sessionName buttons {"OK"} default button "OK" with title "Error" with icon stop
				return "" -- Return empty string to indicate an error
			end if
			
			return sessionFolder -- Return the session folder path
		end tell
	on error
		display dialog "An error occurred while retrieving the Capture One session folder." buttons {"OK"} default button "OK"
		return "" -- Return empty string on error
	end try
end getCurrentCaptureSessionFolder

-- Function: Show a folder selection dialog
on chooseFolderDialog()
	try
		set destinationFolder to POSIX path of (choose folder with prompt "Select a destination folder for backup")
		return destinationFolder
	on error number -128 -- User pressed Cancel
		return "" -- Return empty string if canceled
	end try
end chooseFolderDialog
