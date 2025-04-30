/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React, { useState, useEffect, type FormEvent } from 'react'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import {
  AppBar, Toolbar, List, ListItem, ListItemText, ListItemIcon, Checkbox, Dialog,
  DialogTitle, DialogContent, DialogContentText, DialogActions, TextField,
  Button, Fab, LinearProgress, Typography, IconButton, Grid, Card, CardContent
} from '@mui/material'
import { styled } from '@mui/system'
import AddIcon from '@mui/icons-material/Add'
import GitHubIcon from '@mui/icons-material/GitHub'
import { WalletClient, PushDrop, Utils, Transaction, LockingScript, type WalletOutput, Beef } from '@bsv/sdk'
// import { Services } from '@bsv/wallet-toolbox-client'

// This is the namespace address for the ToDo protocol
const TODO_PROTO_ADDR = '1ToDoDtKreEzbHYKFjmoBuduFmSXXUGZG'

// Styled components
const AppBarPlaceholder = styled('div')({
  height: '4em'
})

const NoItems = styled(Grid)({
  margin: 'auto',
  textAlign: 'center',
  marginTop: '5em'
})

const AddMoreFab = styled(Fab)(({ theme }) => ({
  position: 'fixed',
  bottom: theme.spacing(2),
  right: theme.spacing(2),
  backgroundColor: 'rgba(0, 200, 200, 0.9)',
  '&:hover': {
    backgroundColor: 'rgba(0, 200, 200, 1)',
  },
}))

const LoadingBar = styled(LinearProgress)({
  margin: '1em'
})

const GitHubIconStyle = styled(GitHubIcon)(({ theme }) => ({
  color: 'rgba(255, 255, 255, 0.9)',
  '&:hover': {
    color: 'rgba(0, 200, 200, 0.9)',
  },
}))

const StyledListItem = styled(ListItem)(({ theme }) => ({
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  marginBottom: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  '&:hover': {
    backgroundColor: 'rgba(0, 200, 200, 0.1)',
  },
}))

const StyledCard = styled(Card)(({ theme }) => ({
  backgroundColor: 'rgba(0, 0, 0, 0.3)',
  border: '1px solid rgba(0, 200, 200, 0.1)',
}))

const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: 'rgba(0, 0, 0, 0.3)',
  borderBottom: '1px solid rgba(0, 200, 200, 0.1)',
}))

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(0, 200, 200, 0.1)',
  },
}))

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    color: 'rgba(255, 255, 255, 0.9)',
    '& fieldset': {
      borderColor: 'rgba(0, 200, 200, 0.3)',
    },
    '&:hover fieldset': {
      borderColor: 'rgba(0, 200, 200, 0.5)',
    },
    '&.Mui-focused fieldset': {
      borderColor: 'rgba(0, 200, 200, 0.7)',
    },
  },
  '& .MuiInputLabel-root': {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: 'rgba(0, 200, 200, 0.7)',
  },
}))

interface Task {
  task: string
  sats: number
  outpoint: string
  lockingScript: string
  beef: number[] | undefined
}

interface ToDoProps {
  walletClient: WalletClient;
}

export const ToDo: React.FC<ToDoProps> = ({ walletClient }) => {
  const [createOpen, setCreateOpen] = useState<boolean>(false)
  const [createTask, setCreateTask] = useState<string>('')
  const [createAmount, setCreateAmount] = useState<number>(1000)
  const [createLoading, setCreateLoading] = useState<boolean>(false)
  const [tasksLoading, setTasksLoading] = useState<boolean>(true)
  const [tasks, setTasks] = useState<Task[]>([])
  const [completeOpen, setCompleteOpen] = useState<boolean>(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [completeLoading, setCompleteLoading] = useState<boolean>(false)

  // Creates a new ToDo token
  const handleCreateSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    try {
      if (createTask === '') {
        toast.error('Enter a task to complete!')
        return
      }
      if (createAmount === 0 || isNaN(createAmount)) {
        toast.error('Enter an amount for the new task!')
        return
      }
      if (createAmount < 1) {
        toast.error('The amount must be more than 1 satoshis!')
        return
      }

      setCreateLoading(true)
      console.log('Starting task creation...')

      console.log('Encrypting task...')
      const encryptedTask = (await walletClient.encrypt({
        plaintext: Utils.toArray(createTask, 'utf8'),
        protocolID: [0, 'todo list'],
        keyID: '1'
      })).ciphertext
      console.log('Task encrypted successfully')

      console.log('Creating PushDrop token...')
      const pushdrop = new PushDrop(walletClient)
      const bitcoinOutputScript = await pushdrop.lock(
        [
          Utils.toArray(TODO_PROTO_ADDR, 'utf8') as number[],
          encryptedTask
        ],
        [0, 'todo list'],
        '1',
        'self'
      )
      console.log('PushDrop token created successfully')

      console.log('Creating transaction...')
      const newToDoToken = await walletClient.createAction({
        outputs: [{
          lockingScript: bitcoinOutputScript.toHex(),
          satoshis: Number(createAmount),
          basket: 'voicemail todo list',
          outputDescription: 'New ToDo list item'
        }],
        options: {
          randomizeOutputs: false,
          acceptDelayedBroadcast: false
        },
        description: `Create a TODO task: ${createTask}`
      }).catch(error => {
        console.error('Error creating transaction:', error);
        if (error.message.includes('basket access')) {
          throw new Error('Failed to access todo list basket. Please ensure you have the correct permissions.');
        }
        throw error;
      });
      console.log('Transaction created successfully:', newToDoToken)

      if (!newToDoToken || !newToDoToken.txid) {
        throw new Error('Failed to create transaction: No transaction ID returned')
      }

      toast.dark('Task successfully created!')
      setTasks([
        {
          task: createTask,
          sats: Number(createAmount),
          outpoint: `${newToDoToken.txid}.0`,
          lockingScript: bitcoinOutputScript.toHex(),
          beef: newToDoToken.tx
        },
        ...tasks
      ])
      setCreateTask('')
      setCreateAmount(1000)
      setCreateOpen(false)
    } catch (e) {
      console.error('Error creating task:', e)
      toast.error(`Failed to create task: ${(e as Error).message}`)
    } finally {
      setCreateLoading(false)
    }
  }

  // Redeems the ToDo token
  const handleCompleteSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    try {
      setCompleteLoading(true)

      if (selectedTask === null) {
        throw new Error('selectedTask does not exist')
      }

      let description = `Complete a TODO task: "${selectedTask.task}"`
      if (description.length > 128) { description = description.substring(0, 128) }

      const txid = selectedTask.outpoint.split('.')[0]
      const outputIndex = selectedTask.outpoint.split('.')[1]
      const loadedBeef = Beef.fromBinary(selectedTask.beef as number[])

      const { signableTransaction } = await walletClient.createAction({
        description,
        inputBEEF: loadedBeef.toBinary(),
        inputs: [{
          inputDescription: 'Complete a ToDo list item',
          outpoint: `${txid}.${outputIndex}`,
          unlockingScriptLength: 73
        }],
        options: {
          randomizeOutputs: false
        }
      })

      if (signableTransaction === undefined) {
        throw new Error('Failed to create signable transaction')
      }
      const partialTx = Transaction.fromBEEF(signableTransaction.tx)

      const unlocker = new PushDrop(walletClient).unlock(
        [0, 'todo list'],
        '1',
        'self',
        'all',
        false,
        selectedTask.sats,
        LockingScript.fromHex(selectedTask.lockingScript)
      )

      const unlockingScript = await unlocker.sign(partialTx, 0)

      const signResult = await walletClient.signAction({
        reference: signableTransaction.reference,
        spends: {
          0: {
            unlockingScript: unlockingScript.toHex()
          }
        }
      })
      console.log(signResult)

      toast.dark('Congrats! Task complete 🎉')
      setTasks((oldTasks) => {
        const index = oldTasks.findIndex(x => x === selectedTask)
        if (index > -1) oldTasks.splice(index, 1)
        return [...oldTasks]
      })
      setSelectedTask(null)
      setCompleteOpen(false)
    } catch (e) {
      toast.error(`Error completing task: ${(e as Error).message}`)
      console.error(e)
    } finally {
      setCompleteLoading(false)
    }
  }

  // Loads existing ToDo tokens
  useEffect(() => {
    void (async () => {
      try {
        const tasksFromBasket = await walletClient.listOutputs({
          basket: 'voicemail todo list',
          include: 'entire transactions'
        })

        const decryptedTasksResults = await Promise.all(tasksFromBasket.outputs.map(async (task: WalletOutput, i: number) => {
          try {
            const txid = tasksFromBasket.outputs[i].outpoint.split('.')[0]
            const tx = Transaction.fromBEEF(tasksFromBasket.BEEF as number[], task.outpoint.split('.')[0])
            const lockingScript = tx!.outputs[0].lockingScript

            const decodedTask = PushDrop.decode(lockingScript)
            const encryptedTask = decodedTask.fields[1]
            const decryptedTaskNumArray =
              await walletClient.decrypt({
                ciphertext: encryptedTask,
                protocolID: [0, 'todo list'],
                keyID: '1'
              })
            const decryptedTask = Utils.toUTF8(decryptedTaskNumArray.plaintext)

            return {
              lockingScript: lockingScript.toHex(),
              outpoint: `${txid}.${i}`,
              sats: task.satoshis ?? 0,
              task: decryptedTask,
              beef: tasksFromBasket.BEEF
            }
          } catch (error) {
            console.error('Error decrypting task:', error)
            return null
          }
        }))

        const decryptedTasks: Task[] = decryptedTasksResults.filter(
          (result): result is Task => result !== null
        )

        setTasks(decryptedTasks.reverse())
      } catch (e) {
        const errorCode = (e as any).code
        if (errorCode !== 'ERR_NO_METANET_IDENTITY') {
          toast.error(`Failed to load ToDo tasks! Error: ${(e as Error).message}`)
          console.error(e)
        }
      } finally {
        setTasksLoading(false)
      }
    })()
  }, [])

  const openCompleteModal = (task: Task) => () => {
    setSelectedTask(task)
    setCompleteOpen(true)
  }

  return (
    <>
      <ToastContainer
        position='top-right'
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
      <StyledCard>
        <CardContent>
          <StyledAppBar position='static'>
            <Toolbar>
              <Typography variant='h6' component='div' sx={{ flexGrow: 1, color: 'rgba(255, 255, 255, 0.9)' }}>
                P2P Voicemail To-do List
              </Typography>
              <GitHubIconStyle onClick={() => window.open('https://github.com/p2ppsr/todo-ts', '_blank')}>
                <GitHubIcon />
              </GitHubIconStyle>
            </Toolbar>
          </StyledAppBar>
          <AppBarPlaceholder />

          {tasks.length >= 1 && (
            <AddMoreFab color='primary' onClick={() => { setCreateOpen(true) }}>
              <AddIcon />
            </AddMoreFab>
          )}

          {tasksLoading
            ? (<LoadingBar />)
            : (
              <List>
                {tasks.length === 0 && (
                  <NoItems container direction='column' justifyContent='center' alignItems='center'>
                    <Grid item justifyContent="center" alignItems="center">
                      <Typography variant='h4' sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>No ToDo Items</Typography>
                      <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        Use the button below to start a task
                      </Typography>
                    </Grid>
                    <Grid item justifyContent="center" alignItems="center" sx={{ paddingTop: '2.5em', marginBottom: '1em' }}>
                      <AddMoreFab onClick={() => { setCreateOpen(true) }}>
                        <AddIcon />
                      </AddMoreFab>
                    </Grid>
                  </NoItems>
                )}
                {tasks.map((x, i) => (
                  <StyledListItem 
                    key={i} 
                    onClick={openCompleteModal(x)}
                    sx={{ width: '100%', textAlign: 'left' }}
                  >
                    <ListItemIcon><Checkbox checked={false} sx={{ color: 'rgba(0, 200, 200, 0.9)' }} /></ListItemIcon>
                    <ListItemText 
                      primary={<Typography sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>{x.task}</Typography>} 
                      secondary={<Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>{x.sats} satoshis</Typography>} 
                    />
                  </StyledListItem>
                ))}
              </List>
            )
          }

          <Dialog open={createOpen} onClose={() => { setCreateOpen(false) }}>
            <form onSubmit={(e) => {
              e.preventDefault()
              void (async () => {
                try {
                  await handleCreateSubmit(e)
                } catch (error) {
                  console.error('Error in form submission:', error)
                }
              })()
            }}>
              <DialogTitle>Create a Task</DialogTitle>
              <DialogContent>
                <Typography variant="body1" paragraph sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                  Describe your task and set aside some satoshis you&apos;ll get back once it&apos;s done.
                </Typography>
                <StyledTextField
                  multiline rows={3} fullWidth autoFocus
                  label='Task to complete'
                  onChange={(e: { target: { value: React.SetStateAction<string> } }) => { setCreateTask(e.target.value) }}
                  value={createTask}
                />
                <br /><br />
                <StyledTextField
                  fullWidth
                  type='number'
                  inputProps={{ min: 1 }}
                  label='Completion amount'
                  onChange={(e: { target: { value: any } }) => { setCreateAmount(Number(e.target.value)) }}
                  value={createAmount}
                />
              </DialogContent>
              {createLoading
                ? (<LoadingBar />)
                : (
                  <DialogActions>
                    <Button onClick={() => { setCreateOpen(false) }}>Cancel</Button>
                    <Button type='submit'>OK</Button>
                  </DialogActions>
                )
              }
            </form>
          </Dialog>

          <Dialog open={completeOpen} onClose={() => { setCompleteOpen(false) }}>
            <form onSubmit={(e) => {
              e.preventDefault()
              void (async () => {
                try {
                  await handleCompleteSubmit(e)
                } catch (error) {
                  console.error('Error in form submission:', error)
                }
              })()
            }}>
              <DialogTitle>Complete &quot;{selectedTask?.task}&quot;?</DialogTitle>
              <DialogContent>
                <Typography variant="body1" paragraph sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                  By marking this task as complete, you&apos;ll receive back your {selectedTask?.sats} satoshis.
                </Typography>
              </DialogContent>
              {completeLoading
                ? (<LoadingBar />)
                : (
                  <DialogActions>
                    <Button onClick={() => { setCompleteOpen(false) }}>Cancel</Button>
                    <Button type='submit'>Complete Task</Button>
                  </DialogActions>
                )
              }
            </form>
          </Dialog>
        </CardContent>
      </StyledCard>
    </>
  )
};

export default ToDo; 