$('.devlog').ready () ->
  devLogContainer = $ '#devlog-container'
  .html '<p>Now loading content</p>'

  $.ajax '/api/devlog',
    type: 'GET',
    success: (body, textStatus, jqXHR) ->
      logs = body.data

      devLogContainer.html ''

      for log in logs
        devLogContainer.append """
          <div class="devlog-item" onClick="navigateToLog(#{log.id})">
            <h2 class="title">#{log.title}</h2>
            <span>Created #{new Date(log.ts).toLocaleDateString()}</span>
          </div>
        """
    error: -> 
      devLogContainer.html '<p>No logs to display</p>'

navigateToLog = (logId) ->
  console.log logId