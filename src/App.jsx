import React, { useState, useRef, useEffect, useMemo } from 'react'
import Groq from 'groq-sdk'
import { db, doc, getDoc, setDoc, onSnapshot, updateDoc } from './firebase'
import { customAlphabet } from 'nanoid' // MUDANÇA: Usar gerador personalizado
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPalette,
  faFlask,
  faFutbol,
  faGlobe,
  faTicket,
  faLandmark,
  faUserGroup
} from '@fortawesome/free-solid-svg-icons'

// Gerador de IDs limpos (apenas letras e números maiúsculos)
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6)

const lastQuestions = {
  art: [],
  science: [],
  sports: [],
  geography: [],
  entertainment: [],
  history: []
}

const categories = [
  { id: 'art', name: 'Arte', color: 'bg-red-500', icon: faPalette },
  { id: 'science', name: 'Ciência', color: 'bg-green-500', icon: faFlask },
  { id: 'sports', name: 'Esporte', color: 'bg-blue-500', icon: faFutbol },
  { id: 'geography', name: 'Geografia', color: 'bg-yellow-500', icon: faGlobe },
  {
    id: 'entertainment',
    name: 'Entretenimento',
    color: 'bg-pink-500',
    icon: faTicket
  },
  { id: 'history', name: 'História', color: 'bg-purple-500', icon: faLandmark }
]

export default function App () {
  // --- ESTADOS LOCAIS (UI) ---
  const [playerName, setPlayerName] = useState('')
  const [gameId, setGameId] = useState('')
  const [isHost, setIsHost] = useState(false)
  const [error, setError] = useState(null)

  // --- ESTADO DO JOGO (Vindo do Firebase) ---
  const [gameData, setGameData] = useState(null)

  // Estados para animação e lógica local
  const [spinningIndex, setSpinningIndex] = useState(null)
  const [localGameState, setLocalGameState] = useState('versus-menu') // versus-menu, idle, waiting, spinning, question, result
  const [localQuestion, setLocalQuestion] = useState(null)
  const [localResult, setLocalResult] = useState(null)
  const [soloScores, setSoloScores] = useState({
    art: 0,
    science: 0,
    sports: 0,
    geography: 0,
    entertainment: 0,
    history: 0
  })

  const spinIntervalRef = useRef(null)

  // --- API KEY ---
  const rawApiKey = process.env.REACT_APP_GROQ_API_KEY
  const [apiKey, setApiKey] = useState(undefined)

  useEffect(() => {
    if (!rawApiKey || rawApiKey === 'undefined') {
      setApiKey(null)
    } else {
      setApiKey(rawApiKey)
    }
  }, [rawApiKey])

  const groqClient = useMemo(() => {
    if (apiKey) {
      return new Groq({ apiKey: apiKey, dangerouslyAllowBrowser: true })
    }
    return null
  }, [apiKey])

  useEffect(() => {
    return () => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current)
    }
  }, [])

  // --- SINCRONIZAÇÃO FIREBASE ---
  // Este useEffect roda sempre que o gameId mudar para conectar na sala certa
  useEffect(() => {
    if (!gameId) return

    // Limpeza do ID para garantir que não haja espaços
    const cleanGameId = gameId.trim().toUpperCase()
    const gameRef = doc(db, 'games', cleanGameId)

    console.log('Tentando conectar na sala:', cleanGameId)

    const unsubscribe = onSnapshot(
      gameRef,
      docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data()
          console.log('Dados recebidos do Firebase:', data)
          setGameData(data) // Salva TUDO que vem do banco

          // Sincroniza Estados Globais apenas se não estivermos processando localmente
          if (localGameState !== 'spinning') {
            // Nova Pergunta
            if (
              data.currentQuestion &&
              data.currentQuestion.pergunta !== localQuestion?.pergunta
            ) {
              setLocalQuestion(data.currentQuestion)
              setLocalGameState('question')
              setLocalResult(null)
            }
            // Resultado
            else if (
              data.lastResult &&
              data.gameState === 'idle' &&
              localGameState !== 'result'
            ) {
              setLocalResult(data.lastResult)
              setLocalGameState('result')
            }
            // Estado Genérico (Waiting -> Idle, etc)
            else if (
              data.gameState !== localGameState &&
              localGameState !== 'question' &&
              localGameState !== 'result'
            ) {
              // Evita sobrescrever o estado se o usuário ainda está digitando nome (versus-menu)
              if (localGameState !== 'versus-menu') {
                setLocalGameState(data.gameState)
              }
            }
          }
        } else {
          // Se o documento sumiu e não estamos no menu, reseta
          if (localGameState !== 'versus-menu') {
            alert('A sala não existe ou foi encerrada.')
            resetGame()
          }
        }
      },
      error => {
        console.error('Erro no listener:', error)
        setError('Erro de conexão com o banco de dados.')
      }
    )

    return () => unsubscribe()
  }, [gameId, localGameState, localQuestion]) // Removi isHost para evitar re-renders desnecessários

  // --- FUNÇÕES DO JOGO ---

  const createGame = async () => {
    if (!playerName) return setError('Digite seu nome')
    setError(null)

    const newId = nanoid() // Gera ID limpo

    try {
      await setDoc(doc(db, 'games', newId), {
        player1Name: playerName,
        player1Score: 0,
        player2Name: null,
        player2Score: 0,
        gameState: 'waiting',
        currentQuestion: null,
        selectedCategory: null,
        lastResult: null,
        createdAt: new Date().toISOString()
      })
      setGameId(newId)
      setIsHost(true)
      setLocalGameState('waiting')
    } catch (e) {
      console.error(e)
      setError('Erro ao criar sala. Verifique permissões do Firestore.')
    }
  }

  const joinGame = async () => {
    if (!playerName || !gameId) return setError('Preencha nome e código')
    setError(null)

    const cleanId = gameId.trim().toUpperCase()
    const gameRef = doc(db, 'games', cleanId)

    try {
      const snap = await getDoc(gameRef)

      if (snap.exists()) {
        const data = snap.data()

        // Verifica se a sala já tem player 2
        if (!data.player2Name) {
          // TENTA Atualizar o banco PRIMEIRO
          await updateDoc(gameRef, { player2Name: playerName })

          // SÓ MUDAR O ESTADO LOCAL SE O AWAIT FUNCIONAR
          setIsHost(false)
          setLocalGameState('waiting')
          console.log('Entrou na sala com sucesso!')
        } else {
          setError('Esta sala já está cheia.')
        }
      } else {
        setError('Sala não encontrada. Verifique o código.')
      }
    } catch (e) {
      console.error('Erro no join:', e)
      // Exibe alerta crítico se falhar ao escrever
      alert(
        `Erro ao entrar: ${e.message}. Verifique se as regras do Firestore permitem escrita.`
      )
      setError('Falha ao conectar na sala.')
    }
  }

  const resetGame = () => {
    setGameId('')
    setGameData(null)
    setPlayerName('')
    setIsHost(false)
    setLocalGameState('versus-menu')
    setLocalQuestion(null)
    setLocalResult(null)
    setError(null)
  }

  const startRound = async () => {
    if (!isHost) return
    // Limpa resultados anteriores e muda estado
    await updateDoc(doc(db, 'games', gameId), {
      gameState: 'spinning',
      lastResult: null
    })
    spinWheel()
  }

  const spinWheel = async () => {
    setLocalGameState('spinning')
    setLocalResult(null)
    setLocalQuestion(null)

    let currentSpin = 0
    spinIntervalRef.current = setInterval(() => {
      setSpinningIndex(currentSpin % categories.length)
      currentSpin++
    }, 100)

    setTimeout(async () => {
      clearInterval(spinIntervalRef.current)
      const finalIndex = Math.floor(Math.random() * categories.length)
      const category = categories[finalIndex]
      setSpinningIndex(finalIndex)

      if (!gameId || isHost) {
        await generateQuestion(category)
      }
    }, 3000)
  }

  const generateQuestion = async category => {
    if (!groqClient) return

    const prompt = `Gere uma pergunta de trivia sobre ${category.name} em JSON formato: {"pergunta": "...", "alternativas": ["A", "B", "C", "D"], "respostaCorreta": "..."}. A resposta correta deve ser idêntica a uma das alternativas. Idioma: PT-BR.`

    try {
      const completion = await groqClient.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' }
      })

      const content = JSON.parse(completion.choices[0]?.message?.content)

      if (gameId) {
        await updateDoc(doc(db, 'games', gameId), {
          currentQuestion: content,
          selectedCategory: category.id,
          gameState: 'question'
        })
      } else {
        setLocalQuestion(content)
        setLocalGameState('question')
      }
    } catch (e) {
      console.error(e)
      setError('Erro na IA. Tente novamente.')
      if (gameId)
        await updateDoc(doc(db, 'games', gameId), { gameState: 'idle' })
      else setLocalGameState('idle')
    }
  }

  const handleAnswer = async answer => {
    if (!localQuestion) return
    const isCorrect = answer === localQuestion.respostaCorreta

    if (gameId) {
      const myScoreField = isHost ? 'player1Score' : 'player2Score'
      // Usa valor atual do banco ou 0
      const currentScore = (gameData && gameData[myScoreField]) || 0

      try {
        await updateDoc(doc(db, 'games', gameId), {
          [myScoreField]: currentScore + (isCorrect ? 1 : 0),
          lastResult: isCorrect ? 'correct' : 'incorrect',
          gameState: 'idle'
        })
      } catch (e) {
        console.error('Erro ao enviar resposta:', e)
      }
    } else {
      // Solo
      if (isCorrect) {
        setLocalResult('correct')
        setSoloScores(prev => ({
          ...prev,
          [categories[spinningIndex].id]: prev[categories[spinningIndex].id] + 1
        }))
      } else {
        setLocalResult('incorrect')
      }
      setLocalGameState('result')
    }
  }

  // --- RENDERERS ---

  const renderScoreboard = () => {
    // Só renderiza placar online se tiver dados
    if (gameId && gameData) {
      return (
        <div className='w-full max-w-lg bg-gray-800 p-4 rounded-xl shadow-lg mb-8 border border-gray-700'>
          <div className='flex justify-between items-center text-gray-400 text-xs mb-2 font-mono'>
            <span>SALA: {gameId}</span>
            <span>{isHost ? '(VOCÊ É O HOST)' : '(VOCÊ É O VISITANTE)'}</span>
          </div>
          <div className='flex justify-between items-center gap-4'>
            {/* PLAYER 1 (HOST) */}
            <div className='flex-1 bg-blue-900/30 p-3 rounded-lg border border-blue-500/30 text-center'>
              <p className='text-blue-200 font-bold truncate text-sm uppercase'>
                {gameData.player1Name}
              </p>
              <p className='text-3xl font-black text-white'>
                {gameData.player1Score}
              </p>
            </div>
            <span className='text-gray-500 font-bold italic'>VS</span>
            {/* PLAYER 2 (VISITANTE) */}
            <div className='flex-1 bg-red-900/30 p-3 rounded-lg border border-red-500/30 text-center'>
              <p className='text-red-200 font-bold truncate text-sm uppercase'>
                {gameData.player2Name || 'Esperando...'}
              </p>
              <p className='text-3xl font-black text-white'>
                {gameData.player2Score}
              </p>
            </div>
          </div>
        </div>
      )
    }
    // Placar Solo
    return (
      <div className='grid grid-cols-3 sm:grid-cols-6 gap-2 w-full max-w-2xl mb-8'>
        {categories.map((cat, i) => (
          <div
            key={cat.id}
            className={`${
              cat.color
            } p-2 rounded-lg flex flex-col items-center transition-transform ${
              localGameState === 'spinning' && spinningIndex === i
                ? 'scale-110 ring-2 ring-white'
                : 'scale-100 opacity-80'
            }`}
          >
            <FontAwesomeIcon icon={cat.icon} className='text-white mb-1' />
            <span className='font-bold text-white'>{soloScores[cat.id]}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-gray-900 text-white font-sans flex flex-col items-center py-8 px-4'>
      <header className='mb-6 text-center'>
        <h1 className='text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-pink-500 drop-shadow-sm'>
          Questionados
        </h1>
      </header>

      {renderScoreboard()}

      <main className='w-full max-w-xl flex-grow flex flex-col justify-center'>
        {error && (
          <div className='bg-red-500/80 p-4 rounded-lg text-center mb-4 font-bold border border-red-400'>
            {error}
            <button
              onClick={() => setError(null)}
              className='block mx-auto mt-2 text-xs underline hover:text-gray-200'
            >
              Fechar
            </button>
          </div>
        )}

        {/* MENU PRINCIPAL / VERSUS */}
        {localGameState === 'versus-menu' && (
          <div className='bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700'>
            <h2 className='text-2xl font-bold text-center mb-6'>Modo Online</h2>
            <input
              className='w-full bg-gray-700 p-4 rounded-lg text-white mb-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all'
              placeholder='Seu Nome'
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
            />
            <div className='flex gap-3 mb-4'>
              <button
                onClick={createGame}
                className='flex-1 bg-green-600 hover:bg-green-500 py-3 rounded-lg font-bold transition-colors'
              >
                Criar Sala
              </button>
              <div className='flex flex-1 gap-2'>
                <input
                  className='w-full bg-gray-700 text-center rounded-lg uppercase font-mono'
                  placeholder='CÓDIGO'
                  maxLength={6}
                  value={gameId}
                  onChange={e => setGameId(e.target.value.toUpperCase())}
                />
                <button
                  onClick={joinGame}
                  className='bg-blue-600 hover:bg-blue-500 px-4 rounded-lg font-bold transition-colors'
                >
                  Ir
                </button>
              </div>
            </div>
            <button
              onClick={() => setLocalGameState('idle')}
              className='w-full py-3 text-gray-400 hover:text-white font-medium'
            >
              Jogar Solo
            </button>
          </div>
        )}

        {/* SALA DE ESPERA (WAITING) */}
        {localGameState === 'waiting' && (
          <div className='bg-gray-800 p-8 rounded-2xl shadow-2xl text-center border border-gray-700'>
            <div className='mb-6 animate-pulse'>
              <FontAwesomeIcon
                icon={faUserGroup}
                className='text-5xl text-blue-400'
              />
            </div>
            <h2 className='text-2xl font-bold mb-2'>Sala de Espera</h2>
            <p className='text-gray-400 mb-6 font-mono tracking-widest text-xl bg-gray-900/50 py-2 rounded-lg inline-block px-6 select-all'>
              {gameId}
            </p>

            {gameData?.player2Name ? (
              <div className='bg-green-500/20 border border-green-500/50 p-4 rounded-xl mb-6'>
                <p className='text-green-400 font-bold text-lg'>
                  Oponente Conectado!
                </p>
                <p className='text-white text-sm mt-1'>
                  {isHost
                    ? `${gameData.player2Name} entrou.`
                    : `Você entrou na sala de ${gameData.player1Name}.`}
                </p>
              </div>
            ) : (
              <div className='bg-yellow-500/20 border border-yellow-500/50 p-4 rounded-xl mb-6'>
                <p className='text-yellow-400 font-bold'>
                  Aguardando oponente...
                </p>
                <p className='text-xs text-gray-400 mt-1'>
                  Compartilhe o código acima.
                </p>
              </div>
            )}

            {/* BOTÃO DE INÍCIO (Apenas Host vê) */}
            {isHost && gameData?.player2Name ? (
              <button
                onClick={startRound}
                className='w-full bg-gradient-to-r from-blue-600 to-purple-600 py-4 rounded-xl font-black text-xl hover:scale-105 transition-transform shadow-lg animate-bounce'
              >
                INICIAR JOGO
              </button>
            ) : (
              <p className='text-gray-500 text-sm animate-pulse'>
                {isHost
                  ? 'Aguardando jogador 2...'
                  : 'Aguardando o Host iniciar o jogo...'}
              </p>
            )}

            <button
              onClick={resetGame}
              className='mt-8 text-red-400 hover:text-red-300 text-sm underline'
            >
              Sair da Sala
            </button>
          </div>
        )}

        {/* GIRANDO (SPINNING) */}
        {localGameState === 'spinning' && (
          <div className='text-center py-12'>
            <div className='text-7xl mb-6 animate-spin'>🎲</div>
            <h2 className='text-3xl font-bold text-white mb-2'>Sorteando...</h2>
            <p className='text-gray-400'>A IA está gerando sua pergunta.</p>
          </div>
        )}

        {/* PERGUNTA (QUESTION) */}
        {localGameState === 'question' && localQuestion && (
          <div className='bg-gray-800 p-6 rounded-2xl shadow-2xl border border-gray-700'>
            <div className='flex justify-center mb-6'>
              <span
                className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white ${
                  categories.find(
                    c =>
                      c.id ===
                      (gameData?.selectedCategory ||
                        (categories[spinningIndex]
                          ? categories[spinningIndex].id
                          : 'art'))
                  )?.color
                }`}
              >
                {
                  categories.find(
                    c =>
                      c.id ===
                      (gameData?.selectedCategory ||
                        (categories[spinningIndex]
                          ? categories[spinningIndex].id
                          : 'art'))
                  )?.name
                }
              </span>
            </div>
            <h3 className='text-xl font-bold text-center mb-8 leading-snug'>
              {localQuestion.pergunta}
            </h3>
            <div className='grid grid-cols-1 gap-3'>
              {localQuestion.alternativas.map((alt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAnswer(alt)}
                  className='bg-gray-700 hover:bg-blue-600 hover:border-blue-400 border border-gray-600 p-4 rounded-xl text-left transition-all font-medium'
                >
                  {alt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* RESULTADO / IDLE */}
        {(localGameState === 'result' ||
          (localGameState === 'idle' && gameId)) && (
          <div className='bg-gray-800 p-8 rounded-2xl shadow-2xl text-center border border-gray-700'>
            <div className='text-6xl mb-4'>
              {localResult === 'correct'
                ? '🎉'
                : localResult === 'incorrect'
                ? '❌'
                : '⏳'}
            </div>
            <h2 className='text-3xl font-bold mb-2'>
              {localResult === 'correct'
                ? 'Acertou!'
                : localResult === 'incorrect'
                ? 'Errou!'
                : 'Fim da Rodada'}
            </h2>

            {gameId ? (
              <div className='mt-6'>
                {isHost ? (
                  <button
                    onClick={startRound}
                    className='bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition-transform active:scale-95'
                  >
                    Próxima Pergunta
                  </button>
                ) : (
                  <p className='text-yellow-400 animate-pulse'>
                    Aguardando Host girar a roleta...
                  </p>
                )}
              </div>
            ) : (
              <button
                onClick={spinWheel}
                className='mt-6 bg-white text-gray-900 px-8 py-3 rounded-full font-bold hover:scale-105 transition-transform'
              >
                Continuar
              </button>
            )}
          </div>
        )}

        {/* MENU IDLE SOLO */}
        {localGameState === 'idle' && !gameId && (
          <div className='flex flex-col gap-4 items-center'>
            <button
              onClick={spinWheel}
              className='w-full max-w-xs bg-white text-gray-900 py-4 rounded-2xl font-black text-xl shadow-xl hover:scale-105 transition-transform flex items-center justify-center gap-2'
            >
              JOGAR SOLO
            </button>
            <button
              onClick={() => setLocalGameState('versus-menu')}
              className='text-gray-400 hover:text-white mt-4'
            >
              Voltar para Menu
            </button>
          </div>
        )}
      </main>

      <footer className='mt-8 text-gray-600 text-xs text-center'>
        Desenvolvido para fins educacionais • Powered by Groq AI
      </footer>
    </div>
  )
}
