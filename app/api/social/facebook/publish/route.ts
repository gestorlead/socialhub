import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    // Get request body
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    // Create authenticated Supabase client using service role
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    console.log(`[Facebook Publish] Publishing for user: ${userId}`)
    const { 
      page_id, 
      message, 
      link,
      media_urls,
      media_type, // 'photo' or 'video'
      scheduled_publish_time,
      targeting,
      privacy
    } = body

    if (!page_id) {
      return NextResponse.json({ error: 'Page ID is required' }, { status: 400 })
    }

    if (!message && !link && !media_urls) {
      return NextResponse.json({ error: 'Message, link or media is required' }, { status: 400 })
    }

    // Get Facebook connection
    const { data: connection, error: connectionError } = await supabase
      .from('social_connections')
      .select('access_token, profile_data')
      .eq('user_id', userId)
      .eq('platform', 'facebook')
      .single()

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'Facebook not connected' }, { status: 404 })
    }

    // Find the page and its access token
    const pages = connection.profile_data?.pages || []
    const page = pages.find((p: any) => p.id === page_id)
    
    if (!page || !page.access_token) {
      return NextResponse.json({ error: 'Page not found or no access token' }, { status: 404 })
    }

    console.log('Publishing to Facebook page:', page.name)

    // Build the post data
    const postData: any = {}
    
    if (message) {
      postData.message = message
    }
    
    if (link) {
      postData.link = link
    }

    if (scheduled_publish_time) {
      const scheduledDate = new Date(scheduled_publish_time)
      const now = new Date()
      const minTime = new Date(now.getTime() + 10 * 60 * 1000) // 10 minutes from now
      const maxTime = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      
      // Validate scheduled time is within Meta's required range
      if (scheduledDate < minTime) {
        return NextResponse.json({
          error: 'Scheduled time must be at least 10 minutes from now'
        }, { status: 400 })
      }
      
      if (scheduledDate > maxTime) {
        return NextResponse.json({
          error: 'Scheduled time cannot be more than 30 days from now'
        }, { status: 400 })
      }
      
      postData.published = false
      postData.scheduled_publish_time = Math.floor(scheduledDate.getTime() / 1000)
    }

    if (targeting) {
      postData.targeting = targeting
    }

    if (privacy) {
      postData.privacy = privacy
    }

    // Determine publication type from request body
    const publicationType = body.publication_type || 'post' // 'post', 'story', 'reels'
    
    let publishResponse
    let uploadedVideoId: string | null = null // Store video_id for status checking
    
    // Handle different types of publications
    if (publicationType === 'story') {
      // Facebook Page Story - requires upload session process
      if (media_urls && media_urls.length > 0) {
        if (media_type === 'video') {
          // Video Story - use upload session process
          console.log('[Facebook Stories] Starting video story upload with URL:', media_urls[0])
          
          // Step 1: Initialize upload session
          const initParams = new URLSearchParams({
            access_token: page.access_token,
            upload_phase: 'start',
            file_url: media_urls[0]
          })
          
          console.log('[Facebook Stories] Step 1 - Starting upload session')
          const initResponse = await fetch(
            `https://graph.facebook.com/v23.0/${page_id}/video_stories`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: initParams
            }
          )
          
          const initResult = await initResponse.json()
          console.log('[Facebook Stories] Step 1 response:', {
            status: initResponse.status,
            ok: initResponse.ok,
            data: initResult
          })
          
          if (initResponse.ok) {
            // Store video_id for status checking
            uploadedVideoId = initResult.video_id
            
            // Step 2: Upload video to the upload_url
            console.log('[Facebook Stories] Step 2 - Uploading video to upload_url:', initResult.upload_url)
            
            // Check file size first (limit to 100MB for Stories)
            const videoResponse = await fetch(media_urls[0], { method: 'HEAD' })
            const contentLength = parseInt(videoResponse.headers.get('content-length') || '0')
            
            if (contentLength > 100 * 1024 * 1024) { // 100MB limit
              publishResponse = new Response(JSON.stringify({
                error: {
                  message: 'Video file too large for Facebook Stories (max 100MB)',
                  code: 400
                }
              }), { status: 400 })
            } else {
              // Fetch the video file from our server
              const videoDownloadResponse = await fetch(media_urls[0])
              if (!videoDownloadResponse.ok) {
                publishResponse = new Response(JSON.stringify({
                  error: {
                    message: 'Failed to fetch video file from server',
                    code: 500
                  }
                }), { status: 500 })
              } else {
                const videoBuffer = await videoDownloadResponse.arrayBuffer()
                
                // Upload to Facebook's upload_url with timeout
                let uploadResponse
                try {
                  uploadResponse = await fetch(initResult.upload_url, {
                    method: 'POST',
                    headers: {
                      'Authorization': `OAuth ${page.access_token}`,
                      'offset': '0',
                      'file_size': videoBuffer.byteLength.toString()
                    },
                    body: videoBuffer
                  })
                  
                  if (uploadResponse.ok) {
                    // Step 3: Finish the upload session
                    const finishParams = new URLSearchParams({
                      access_token: page.access_token,
                      upload_phase: 'finish',
                      upload_session_id: initResult.upload_session_id,
                      video_id: initResult.video_id
                    })
                    
                    console.log('[Facebook Stories] Step 3 - Finishing upload session')
                    publishResponse = await fetch(
                      `https://graph.facebook.com/v23.0/${page_id}/video_stories`,
                      {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        body: finishParams
                      }
                    )
                  } else {
                    publishResponse = uploadResponse
                  }
                } catch (error) {
                  console.error('[Facebook Stories] Upload failed:', error)
                  publishResponse = new Response(JSON.stringify({
                    error: {
                      message: 'Upload to Facebook failed: ' + error.message,
                      code: 500
                    }
                  }), { status: 500 })
                }
              }
            }
          } else {
            publishResponse = initResponse
          }
        } else {
          // Photo Story
          // First upload photo without publishing
          const photoResponse = await fetch(
            `https://graph.facebook.com/v23.0/${page_id}/photos`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: new URLSearchParams({
                access_token: page.access_token,
                url: media_urls[0],
                published: 'false'
              })
            }
          )
          
          if (photoResponse.ok) {
            const photoData = await photoResponse.json()
            // Then publish as story
            publishResponse = await fetch(
              `https://graph.facebook.com/v23.0/${page_id}/photo_stories`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                  access_token: page.access_token,
                  photo_id: photoData.id
                })
              }
            )
          } else {
            publishResponse = photoResponse
          }
        }
      }
    } else if (publicationType === 'reels') {
      // Facebook Reels - requires upload session process  
      if (media_urls && media_urls.length > 0 && media_type === 'video') {
        console.log('[Facebook Reels] Starting reels upload with URL:', media_urls[0])
        
        // Step 1: Initialize upload session
        const initReelsParams = new URLSearchParams({
          access_token: page.access_token,
          upload_phase: 'start'
        })
        
        console.log('[Facebook Reels] Step 1 - Starting upload session')
        const initReelsResponse = await fetch(
          `https://graph.facebook.com/v23.0/${page_id}/video_reels`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: initReelsParams
          }
        )
        
        const initReelsResult = await initReelsResponse.json()
        console.log('[Facebook Reels] Step 1 response:', {
          status: initReelsResponse.status,
          ok: initReelsResponse.ok,
          data: initReelsResult
        })
        
        if (initReelsResponse.ok) {
          // Store video_id for status checking
          uploadedVideoId = initReelsResult.video_id
          
          // Step 2: Upload video to the upload_url
          console.log('[Facebook Reels] Step 2 - Uploading video to upload_url:', initReelsResult.upload_url)
          
          // Check file size first (limit to 4GB for Reels but recommend 100MB)
          const videoResponse = await fetch(media_urls[0], { method: 'HEAD' })
          const contentLength = parseInt(videoResponse.headers.get('content-length') || '0')
          
          if (contentLength > 200 * 1024 * 1024) { // 200MB limit for better upload success
            publishResponse = new Response(JSON.stringify({
              error: {
                message: 'Video file too large for Facebook Reels (max 200MB recommended)',
                code: 400
              }
            }), { status: 400 })
          } else {
            // Fetch the video file from our server
            const videoDownloadResponse = await fetch(media_urls[0])
            if (!videoDownloadResponse.ok) {
              publishResponse = new Response(JSON.stringify({
                error: {
                  message: 'Failed to fetch video file from server',
                  code: 500
                }
              }), { status: 500 })
            } else {
              const videoBuffer = await videoDownloadResponse.arrayBuffer()
              
              // Upload to Facebook's upload_url with error handling
              let uploadResponse
              try {
                uploadResponse = await fetch(initReelsResult.upload_url, {
                  method: 'POST',
                  headers: {
                    'Authorization': `OAuth ${page.access_token}`,
                    'offset': '0',
                    'file_size': videoBuffer.byteLength.toString()
                  },
                  body: videoBuffer
                })
                
                if (uploadResponse.ok) {
                  // Step 3: Finish and publish
                  const finishReelsParams = new URLSearchParams({
                    access_token: page.access_token,
                    upload_phase: 'finish',
                    video_id: initReelsResult.video_id,
                    video_state: 'PUBLISHED'
                  })
                  
                  // Add description if provided
                  if (postData.message) {
                    finishReelsParams.append('description', postData.message)
                  }
                  
                  console.log('[Facebook Reels] Step 3 - Finishing upload session')
                  publishResponse = await fetch(
                    `https://graph.facebook.com/v23.0/${page_id}/video_reels`,
                    {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                      },
                      body: finishReelsParams
                    }
                  )
                } else {
                  publishResponse = uploadResponse
                }
              } catch (error) {
                console.error('[Facebook Reels] Upload failed:', error)
                publishResponse = new Response(JSON.stringify({
                  error: {
                    message: 'Upload to Facebook failed: ' + error.message,
                    code: 500
                  }
                }), { status: 500 })
              }
            }
          }
        } else {
          publishResponse = initReelsResponse
        }
      } else {
        return NextResponse.json({
          error: 'Reels require a video file'
        }, { status: 400 })
      }
    } else {
      // Regular Facebook Post
      if (media_urls && media_urls.length > 0) {
        if (media_type === 'video') {
          // Video post - use videos endpoint with file_url
          console.log('[Facebook Video Post] Starting video post upload with URL:', media_urls[0])
          
          const videoParams = new URLSearchParams({
            access_token: page.access_token,
            file_url: media_urls[0]
          })
          
          // Add description if provided
          if (postData.message) {
            videoParams.append('description', postData.message)
          }
          
          // Set published status
          videoParams.append('published', postData.published !== false ? 'true' : 'false')
          
          // Add scheduled time if specified
          if (postData.scheduled_publish_time) {
            videoParams.append('scheduled_publish_time', postData.scheduled_publish_time.toString())
          }
          
          console.log('[Facebook Video Post] Uploading video to /videos endpoint')
          publishResponse = await fetch(
            `https://graph.facebook.com/v23.0/${page_id}/videos`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: videoParams
            }
          )
        } else {
          // Photo post(s)
          if (media_urls.length === 1) {
            // Single photo post
            publishResponse = await fetch(
              `https://graph.facebook.com/v23.0/${page_id}/photos`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                  access_token: page.access_token,
                  url: media_urls[0],
                  caption: postData.message || '',
                  published: postData.published !== false ? 'true' : 'false',
                  ...(postData.scheduled_publish_time && { scheduled_publish_time: postData.scheduled_publish_time })
                })
              }
            )
          } else {
            // Multiple photos - create album
            const photoIds = []
            
            // Upload each photo without publishing
            for (const mediaUrl of media_urls) {
              const photoResponse = await fetch(
                `https://graph.facebook.com/v23.0/${page_id}/photos`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                  },
                  body: new URLSearchParams({
                    access_token: page.access_token,
                    url: mediaUrl,
                    published: 'false'
                  })
                }
              )
              
              if (photoResponse.ok) {
                const photoData = await photoResponse.json()
                photoIds.push({ media_fbid: photoData.id })
              }
            }
            
            // Create the album post
            publishResponse = await fetch(
              `https://graph.facebook.com/v23.0/${page_id}/feed`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                  access_token: page.access_token,
                  message: postData.message || '',
                  attached_media: JSON.stringify(photoIds),
                  published: postData.published !== false ? 'true' : 'false',
                  ...(postData.scheduled_publish_time && { scheduled_publish_time: postData.scheduled_publish_time })
                })
              }
            )
          }
        }
      } else {
        // Text only post
        publishResponse = await fetch(
          `https://graph.facebook.com/v23.0/${page_id}/feed`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              access_token: page.access_token,
              message: postData.message || '',
              ...(postData.link && { link: postData.link }),
              published: postData.published !== false ? 'true' : 'false',
              ...(postData.scheduled_publish_time && { scheduled_publish_time: postData.scheduled_publish_time })
            })
          }
        )
      }
    }

    if (!publishResponse.ok) {
      const errorData = await publishResponse.json()
      console.error('Facebook publish error:', errorData)
      
      return NextResponse.json(
        { 
          error: 'Failed to publish to Facebook',
          details: errorData.error?.message || 'Unknown error'
        },
        { status: 400 }
      )
    }

    const result = await publishResponse.json()
    console.log('Facebook publish success:', result)

    const postId = result.id || result.post_id
    
    // Check if the response indicates video processing (common for Stories and Reels)
    const isProcessing = result.message && result.message.toLowerCase().includes('processing')
    
    // Variables for status checking
    let attempts = 0
    const maxAttempts = 12
    
    if (isProcessing && (publicationType === 'story' || publicationType === 'reels')) {
      console.log(`[Facebook ${publicationType}] Video is processing, starting status checks`)
      console.log(`[Facebook ${publicationType}] Using video_id: ${uploadedVideoId}, post_id: ${postId}`)
      
      const checkStatus = async (): Promise<boolean> => {
        try {
          // Wait 10 seconds before checking
          await new Promise(resolve => setTimeout(resolve, 10000))
          
          let statusEndpoint = ''
          
          if (publicationType === 'story' || publicationType === 'reels') {
            // For both Stories and Reels, check the video status with detailed fields
            if (uploadedVideoId) {
              // Request detailed status information including all phases
              statusEndpoint = `https://graph.facebook.com/v23.0/${uploadedVideoId}?fields=status&access_token=${page.access_token}`
            } else {
              // Fallback to checking the post
              if (publicationType === 'story') {
                statusEndpoint = `https://graph.facebook.com/v23.0/${page_id}/video_stories?fields=id,status,video&access_token=${page.access_token}&limit=10`
              } else {
                statusEndpoint = `https://graph.facebook.com/v23.0/${postId}?fields=id,created_time&access_token=${page.access_token}`
              }
            }
          }
          
          const statusResponse = await fetch(statusEndpoint, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          })

          const statusData = await statusResponse.json()
          
          console.log(`[Facebook ${publicationType}] Status check ${attempts + 1}/${maxAttempts}:`, {
            endpoint: statusEndpoint.split('?')[0], // Log endpoint without token
            status: statusResponse.status,
            ok: statusResponse.ok,
            data: statusData
          })

          // Check status for both Stories and Reels
          if (uploadedVideoId && statusResponse.ok && statusData.status) {
            const videoStatus = statusData.status
            
            // Check if status is an object with detailed phases
            if (typeof videoStatus === 'object') {
              const { video_status, uploading_phase, processing_phase, publishing_phase } = videoStatus
              
              console.log(`[Facebook ${publicationType}] Detailed status:`, {
                video_status,
                uploading: uploading_phase?.status,
                processing: processing_phase?.status,
                publishing: publishing_phase?.status,
                publish_status: publishing_phase?.publish_status
              })
              
              // Check for errors in any phase
              if (video_status === 'error' || 
                  uploading_phase?.status === 'error' || 
                  processing_phase?.status === 'error') {
                console.error(`[Facebook ${publicationType}] Video ${uploadedVideoId} processing failed`)
                return true // Exit loop on error
              }
              
              // Check if video is ready and published
              if (video_status === 'ready' && 
                  uploading_phase?.status === 'complete' &&
                  processing_phase?.status === 'complete' &&
                  publishing_phase?.status === 'complete' &&
                  publishing_phase?.publish_status === 'published') {
                console.log(`[Facebook ${publicationType}] Video ${uploadedVideoId} is fully processed and published`)
                console.log(`[Facebook ${publicationType}] Published at: ${publishing_phase.publish_time}`)
                return true
              }
              
              // Log progress for monitoring
              if (uploading_phase?.status === 'in_progress') {
                console.log(`[Facebook ${publicationType}] Uploading: ${uploading_phase.bytes_transferred || 0} bytes transferred`)
              }
              if (processing_phase?.status === 'in_progress') {
                console.log(`[Facebook ${publicationType}] Processing video...`)
              }
              if (publishing_phase?.status === 'in_progress') {
                console.log(`[Facebook ${publicationType}] Publishing video...`)
              }
              
            } else if (typeof videoStatus === 'string') {
              // Simple status string (legacy format)
              console.log(`[Facebook ${publicationType}] Simple status: ${videoStatus}`)
              
              if (videoStatus === 'ready') {
                console.log(`[Facebook ${publicationType}] Video ${uploadedVideoId} is ready`)
                return true
              } else if (videoStatus === 'error' || videoStatus === 'expired') {
                console.error(`[Facebook ${publicationType}] Video ${uploadedVideoId} status: ${videoStatus}`)
                return true // Exit loop on error/expired
              }
            }
          } else if (!uploadedVideoId && statusResponse.ok) {
            // Fallback checks when we don't have video_id
            if (publicationType === 'story' && statusData.data) {
              const ourStory = statusData.data.find((story: any) => story.id === postId)
              if (ourStory && ourStory.status === 'published') {
                console.log(`[Facebook story] Post ${postId} is now published`)
                return true
              }
            } else if (publicationType === 'reels' && statusData.id) {
              console.log(`[Facebook reels] Post ${postId} is accessible`)
              return true
            }
          }
          
          return false
        } catch (error) {
          console.error(`[Facebook ${publicationType}] Status check error:`, error)
          return false
        }
      }

      // Check status up to maxAttempts times
      while (attempts < maxAttempts) {
        attempts++
        const isReady = await checkStatus()
        
        if (isReady) {
          console.log(`[Facebook ${publicationType}] Post ${postId} processing completed after ${attempts} attempts`)
          break
        }
      }
      
      if (attempts >= maxAttempts) {
        console.log(`[Facebook ${publicationType}] Post ${postId} still processing after ${maxAttempts} attempts, but continuing...`)
      }
    }

    // Save publish record
    const postRecord: any = {
      user_id: userId,
      platform: 'facebook',
      platform_post_id: postId,
      content: message || '',
      media_urls: media_urls || [],
      status: scheduled_publish_time ? 'scheduled' : 'published',
      published_at: scheduled_publish_time ? null : new Date().toISOString(),
      metadata: {
        page_name: page.name,
        publication_type: publicationType,
        processing_completed: !isProcessing || attempts < maxAttempts,
        video_id: uploadedVideoId
      }
    }

    // Add optional fields only if they exist and are valid
    if (page_id && typeof page_id === 'string') {
      postRecord.page_id = page_id
    }
    if (media_type && typeof media_type === 'string') {
      postRecord.media_type = media_type
    }
    if (scheduled_publish_time) {
      postRecord.scheduled_at = new Date(scheduled_publish_time).toISOString()
    }
    if (link && typeof link === 'string') {
      postRecord.metadata.link = link
    }
    if (targeting) {
      postRecord.metadata.targeting = targeting
    }
    if (privacy && typeof privacy === 'string') {
      postRecord.metadata.privacy = privacy
    }

    console.log('[Facebook Publish] Attempting to save post record:', JSON.stringify({
      user_id: postRecord.user_id,
      platform: postRecord.platform,
      platform_post_id: postRecord.platform_post_id,
      page_id: postRecord.page_id,
      content: postRecord.content?.substring(0, 100) + '...',
      media_urls_count: postRecord.media_urls?.length || 0,
      status: postRecord.status,
      metadata_keys: Object.keys(postRecord.metadata || {})
    }, null, 2))

    // Use service role client (bypasses RLS)
    const { error: saveError } = await supabase
      .from('social_posts')
      .insert(postRecord)

    if (saveError) {
      console.error('Error saving post record:', saveError)
      console.error('Failed record data:', JSON.stringify(postRecord, null, 2))
    } else {
      console.log('[Facebook Publish] Post record saved successfully to database')
    }

    return NextResponse.json({
      success: true,
      post_id: postId,
      page_id: page_id,
      page_name: page.name,
      scheduled: !!scheduled_publish_time,
      processing_completed: !isProcessing || attempts < maxAttempts,
      message: isProcessing ? 
        `${publicationType} published successfully. Video processing ${attempts < maxAttempts ? 'completed' : 'may still be ongoing'}.` : 
        `${publicationType} published successfully.`
    })

  } catch (error) {
    console.error('Facebook publish error:', error)
    return NextResponse.json(
      { error: 'Failed to publish to Facebook' },
      { status: 500 }
    )
  }
}