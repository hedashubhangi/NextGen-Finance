import { useCallback, useEffect, useRef, useState } from 'react'
import './ChapterOne.css'

export type ActivityProgress = { id: string; xp: number; coins: number; goal?: string; plan?: string; score?: number }
export type QuestionProgress = { order: number[]; index: number; seen: number[]; streak: number; choice: number | null; result: boolean | null; answerOrder?: number[] }
export type ActivityState = Record<string, string | number | boolean | null>
export type LearningState = { activeActivity: string; questionProgress: Record<string, QuestionProgress>; activityProgress: Record<string, ActivityState> }

type ChapterOneProps = {
  learnerName: string
  completed: string[]
  xp: number
  coins: number
  savingsGoal?: { goal: string; plan: string; updatedAt: string } | null
  selectedActivity: string
  learningState: LearningState
  onSelectActivity: (id: string) => void
  onComplete: (activity: ActivityProgress) => Promise<boolean>
  onSaveQuestionProgress: (activityId: string, progress: QuestionProgress) => void
  onSaveActivityProgress: (activityId: string, progress: ActivityState) => void
}

type CourseItem = { id: string; label: string; title: string; reward?: ActivityProgress }
type Question = { prompt: string; answers: string[]; correct: number; explanation: string }
type YouTubePlayerInstance = { getCurrentTime: () => number; seekTo: (seconds: number, allowSeekAhead: boolean) => void; destroy: () => void }
type YouTubePlayerApi = {
  Player?: new (element: HTMLElement, options: {
    videoId: string
    playerVars: { rel: number }
    events: { onReady: (event: { target: YouTubePlayerInstance }) => void }
  }) => YouTubePlayerInstance
}
const videoLinks: Record<string, string> = { 'video-1': '_5Y96gqqHdU', 'video-2': '5aPQ1ffgkfw', 'video-3': 'AsbhSX2KW2U' }

declare global {
  interface Window {
    YT?: YouTubePlayerApi
  }
}

const course: CourseItem[] = [
  { id: 'welcome', label: 'START HERE', title: 'Welcome to Money Basics', reward: { id: 'welcome', xp: 5, coins: 0 } },
  { id: 'vocabulary', label: 'VOCABULARY', title: 'Money words', reward: { id: 'vocabulary', xp: 10, coins: 0 } },
  { id: 'video-1', label: 'VIDEO 1', title: 'What is money?', reward: { id: 'video-1', xp: 5, coins: 1 } },
  { id: 'check-1', label: 'QUICK CHECK', title: 'What is money?', reward: { id: 'check-1', xp: 5, coins: 3 } },
  { id: 'article-1', label: 'ARTICLE 1', title: 'Why do we use money?', reward: { id: 'article-1', xp: 5, coins: 0 } },
  { id: 'barter', label: 'ARCADE GAME 1', title: 'Barter Market', reward: { id: 'barter', xp: 10, coins: 5 } },
  { id: 'video-2', label: 'VIDEO 2', title: 'Goods vs. services', reward: { id: 'video-2', xp: 5, coins: 1 } },
  { id: 'check-2', label: 'QUICK CHECK', title: 'Goods vs. services', reward: { id: 'check-2', xp: 5, coins: 2 } },
  { id: 'article-2', label: 'ARTICLE 2', title: 'Goods vs. services', reward: { id: 'article-2', xp: 5, coins: 0 } },
  { id: 'sort', label: 'ARCADE GAME 2', title: 'Goods Dash', reward: { id: 'sort', xp: 10, coins: 5 } },
  { id: 'video-3', label: 'VIDEO 3', title: 'Needs vs. wants', reward: { id: 'video-3', xp: 5, coins: 1 } },
  { id: 'check-3', label: 'QUICK CHECK', title: 'Needs vs. wants', reward: { id: 'check-3', xp: 5, coins: 2 } },
  { id: 'practice-money', label: 'PRACTICE 1', title: 'What is money?', reward: { id: 'practice-money', xp: 15, coins: 5 } },
  { id: 'practice-goods', label: 'PRACTICE 2', title: 'Goods vs. services', reward: { id: 'practice-goods', xp: 15, coins: 5 } },
  { id: 'practice-needs', label: 'PRACTICE 3', title: 'Needs vs. wants', reward: { id: 'practice-needs', xp: 15, coins: 5 } },
  { id: 'needs-game', label: 'ARCADE GAME 3', title: 'Needs-vs-Wants Catcher', reward: { id: 'needs-game', xp: 12, coins: 5 } },
  { id: 'review', label: 'REVIEW', title: 'Chapter review', reward: { id: 'review', xp: 10, coins: 5 } },
  { id: 'chapter-quiz', label: 'QUIZ', title: 'Chapter 1 assessment', reward: { id: 'chapter-quiz', xp: 25, coins: 10 } },
  { id: 'chapter-test', label: 'FINAL TEST', title: 'Chapter 1 final assessment', reward: { id: 'chapter-test', xp: 50, coins: 20 } },
  { id: 'final-project', label: 'FINAL PROJECT', title: 'My savings goal', reward: { id: 'final-project', xp: 25, coins: 10 } },
  { id: 'completion', label: 'CELEBRATE', title: 'You are a Money Explorer!' },
]

const vocabulary = [
  ['Money', 'Something people use to buy things they need and want.', 'My mom used money to buy groceries.', '💵', 'Dollar bill'],
  ['Barter', 'Trading one thing for another without using money.', 'I traded my toy car for my friend’s puzzle.', '🤝', 'Trading an apple for bread'],
  ['Goods', 'Things you can touch and buy.', 'An apple, book, bicycle, and teddy bear are goods.', '📦', 'Toy'],
  ['Service', 'Something someone does to help another person.', 'A teacher and a doctor provide services.', '👩‍🏫', 'Teacher'],
  ['Need', 'Something people must have to live safely and stay healthy.', 'Water, food, a home, and clothes are needs.', '🍎', 'Water'],
  ['Want', 'Something you would like but do not need.', 'A video game, candy, and stickers can be wants.', '🎮', 'Toy'],
  ['Income', 'Money people earn by working.', 'A chef, teacher, and doctor earn income from work.', '💼', 'Working'],
] as const

const checks: Record<string, Question[]> = {
  'check-1': [
    { prompt: 'What do people use money for?', answers: ['Buying things', 'Sleeping', 'Playing soccer', 'Riding bicycles'], correct: 0, explanation: 'People use money to buy things they need and want.' },
    { prompt: 'Before money, people traded things. What was this called?', answers: ['Saving', 'Shopping', 'Bartering', 'Borrowing'], correct: 2, explanation: 'Bartering means trading one thing for another.' },
    { prompt: 'Why did people start using money?', answers: ['Trading was sometimes difficult', 'Money looks cool', 'They wanted heavier pockets'], correct: 0, explanation: 'Money made buying and selling much easier.' },
    { prompt: 'Which is an example of using money?', answers: ['Paying a coin for a book', 'Trading a book for a sandwich', 'Giving a book away'], correct: 0, explanation: 'Money is used to buy goods and services.' },
    { prompt: 'What does money help people do?', answers: ['Exchange things more easily', 'Grow more food', 'Make every item free'], correct: 0, explanation: 'People can use money to exchange value instead of finding a direct trade.' },
    { prompt: 'Which choice describes bartering?', answers: ['Saving coins in a jar', 'Trading a toy for a book', 'Buying a snack with a bill'], correct: 1, explanation: 'Bartering is trading one thing for another without using money.' },
    { prompt: 'Why might a direct trade be hard?', answers: ['Both people may not want what the other has', 'People cannot share objects', 'Goods cannot be carried'], correct: 0, explanation: 'A trade only works when both people want what the other person offers.' },
    { prompt: 'Maya pays a dollar for a notebook. How did she get it?', answers: ['She used money to buy it', 'She bartered for it', 'She earned the notebook'], correct: 0, explanation: 'Maya exchanged money with the seller to buy a good.' },
    { prompt: 'Which is one thing money can help people buy?', answers: ['A meal', 'A sunny day', 'A birthday'], correct: 0, explanation: 'People can use money to buy goods such as a meal.' },
    { prompt: 'A farmer trades carrots for a basket. What is this called?', answers: ['Income', 'Bartering', 'Shopping with money'], correct: 1, explanation: 'The farmer trades goods directly without using money, which is bartering.' },
    { prompt: 'Why might a baker accept money for bread?', answers: ['The baker can use it to buy other things', 'Money makes bread grow', 'The baker must trade for the same bread'], correct: 0, explanation: 'Money can be exchanged with many people for different goods and services.' },
    { prompt: 'Which situation uses money as an exchange?', answers: ['Paying for a haircut', 'Swapping a toy for a book', 'Sharing an apple'], correct: 0, explanation: 'Paying for a haircut uses money to buy a service.' },
  ],
  'check-2': [
    { prompt: 'Which one is a good?', answers: ['Apple', 'Haircut', 'Teacher teaching', 'Doctor visit'], correct: 0, explanation: 'An apple is a good because you can hold it.' },
    { prompt: 'Which one is a service?', answers: ['Book', 'Bicycle', 'Haircut', 'Pizza'], correct: 2, explanation: 'A haircut is work someone does to help you.' },
    { prompt: 'Money can be used to buy…', answers: ['Only goods', 'Only services', 'Both goods and services'], correct: 2, explanation: 'Money buys both things and helpful work.' },
    { prompt: 'Which is a service?', answers: ['A book', 'A bicycle', 'A piano lesson'], correct: 2, explanation: 'A piano lesson is work someone does to teach another person.' },
    { prompt: 'Which pair has a good and a service?', answers: ['A toy and a haircut', 'A haircut and a lesson', 'A book and an apple'], correct: 0, explanation: 'A toy is a good you can touch; a haircut is a service.' },
    { prompt: 'A gardener mows a lawn. What is the mowing?', answers: ['A service', 'A good', 'Money'], correct: 0, explanation: 'Mowing is helpful work someone does, so it is a service.' },
    { prompt: 'Which can you hold in your hands?', answers: ['A dentist visit', 'A bicycle', 'A music lesson'], correct: 1, explanation: 'A bicycle is a physical thing, so it is a good.' },
    { prompt: 'A music teacher gives a lesson. The lesson is…', answers: ['A service', 'A good', 'A coin'], correct: 0, explanation: 'Teaching is work that helps someone learn, so it is a service.' },
    { prompt: 'Which is something you can hold and take home?', answers: ['A loaf of bread', 'A swimming lesson', 'A bus ride'], correct: 0, explanation: 'Bread is a physical item, so it is a good.' },
    { prompt: 'Money can buy a bicycle and pay for a repair. What are these?', answers: ['A good and a service', 'Two services', 'Two kinds of income'], correct: 0, explanation: 'A bicycle is a good, and repairing it is a service.' },
    { prompt: 'A haircut is different from a hat because…', answers: ['A haircut is work; a hat is an object', 'A hat is income', 'Both are money'], correct: 0, explanation: 'The haircut is a service someone does; the hat is a physical good.' },
    { prompt: 'Which worker provides a service?', answers: ['A dentist helping a patient', 'A toy sitting on a shelf', 'A book in a bag'], correct: 0, explanation: 'The dentist provides helpful care, which is a service.' },
    { prompt: 'What does a baker provide when selling a loaf?', answers: ['A good', 'A haircut', 'Income'], correct: 0, explanation: 'Bread is a physical item you can take home, so it is a good.' },
    { prompt: 'A dog walker takes a dog for a walk. What is the walk?', answers: ['A service', 'A good', 'A coin'], correct: 0, explanation: 'Walking the dog is helpful work provided for someone.' },
    { prompt: 'Which example is a good?', answers: ['A toy boat', 'A piano lesson', 'A haircut'], correct: 0, explanation: 'A toy boat is a physical object that can be touched.' },
    { prompt: 'What does a doctor provide during a checkup?', answers: ['A service', 'A bicycle', 'A book'], correct: 0, explanation: 'A doctor provides helpful care, which is a service.' },
    { prompt: 'Which statement about goods and services is true?', answers: ['People can buy both with money', 'Only services can be bought', 'Goods are always free'], correct: 0, explanation: 'Money can be used to buy physical goods and helpful services.' },
  ],
  'check-3': [
    { prompt: 'Which one is a need?', answers: ['Video game', 'Apple', 'Teddy bear', 'Candy'], correct: 1, explanation: 'Food helps keep us healthy, so it is a need.' },
    { prompt: 'Which one is a want?', answers: ['Water', 'Clothes', 'Video game', 'House'], correct: 2, explanation: 'Video games are fun, but we can live without them.' },
    { prompt: 'Penny has $10. She needs lunch and wants a teddy bear. What should she buy first?', answers: ['Teddy bear', 'Lunch'], correct: 1, explanation: 'Needs come before wants.' },
    { prompt: 'Which is a need?', answers: ['Clean water', 'A new video game', 'A shiny sticker'], correct: 0, explanation: 'People need water to stay healthy and alive.' },
    { prompt: 'Which is a want?', answers: ['A warm coat in winter', 'A safe home', 'A toy robot'], correct: 2, explanation: 'A toy robot is fun, but it is not needed to live safely.' },
    { prompt: 'You have money for one item: medicine or candy. What comes first?', answers: ['Candy', 'Medicine'], correct: 1, explanation: 'Medicine helps protect health, so it is a need.' },
    { prompt: 'Why should people think about needs before wants?', answers: ['Needs help us stay safe and healthy', 'Wants are always free', 'Needs are more colorful'], correct: 0, explanation: 'Taking care of needs supports health and safety before spending on extras.' },
    { prompt: 'Which should usually come first in a shopping plan?', answers: ['Healthy food', 'A new toy', 'Extra candy'], correct: 0, explanation: 'Healthy food supports our bodies, so it is a need to plan for first.' },
    { prompt: 'A warm coat is important on a cold day because it…', answers: ['Helps keep us safe and warm', 'Is always a toy', 'Can replace money'], correct: 0, explanation: 'Clothing that protects us from cold supports our health and safety.' },
    { prompt: 'Which item is usually an extra rather than a need?', answers: ['A sticker book', 'Clean water', 'A safe place to sleep'], correct: 0, explanation: 'A sticker book can be fun, but people can live safely without it.' },
    { prompt: 'Why might someone save money before buying a want?', answers: ['To make sure important needs are covered', 'Because wants are not allowed', 'So money disappears'], correct: 0, explanation: 'Planning for needs first helps people use their money responsibly.' },
    { prompt: 'Which choice is usually a want?', answers: ['A toy set', 'A meal when hungry', 'A safe home'], correct: 0, explanation: 'A toy set is enjoyable, but it is not needed for health or safety.' },
  ],
}

const assessments: Record<string, Question[]> = {
  'practice-money': [
    { prompt: 'What is money?', answers: ['Something people use to buy things', 'A type of food', 'A pet'], correct: 0, explanation: 'Money helps people buy what they need and want.' },
    { prompt: 'Emma trades apples for bread. What is she doing?', answers: ['Saving', 'Bartering', 'Borrowing'], correct: 1, explanation: 'Bartering means trading instead of using money.' },
    { prompt: 'Without money, what would people have to do?', answers: ['Trade things', 'Stop shopping forever', 'Throw things away'], correct: 0, explanation: 'People would often have to barter.' },
    { prompt: 'Which choice shows money being used?', answers: ['Paying for a loaf of bread', 'Trading a ball for a book', 'Giving away a toy'], correct: 0, explanation: 'Money can be exchanged for goods such as bread.' },
    { prompt: 'Why can money be easier than bartering?', answers: ['People can use it to buy from many sellers', 'It makes goods disappear', 'It means nobody has to work'], correct: 0, explanation: 'Money gives buyers and sellers a common way to exchange value.' },
    { prompt: 'Which is a barter trade?', answers: ['Paying $2 for a snack', 'Trading a comic for a puzzle', 'Saving a coin'], correct: 1, explanation: 'Trading a comic for a puzzle exchanges goods directly without money.' },
    { prompt: 'What might happen if a trader does not want your item?', answers: ['The trade may not work', 'The item becomes money', 'You must give it away'], correct: 0, explanation: 'Bartering depends on both people wanting what the other offers.' },
    { prompt: 'Ravi earns $5 by helping at a family shop. What is the $5?', answers: ['Income', 'A good', 'A barter'], correct: 0, explanation: 'Income is money earned by working.' },
    { prompt: 'Which example shows buying a service with money?', answers: ['Paying a barber for a haircut', 'Swapping a book for a ball', 'Picking an apple'], correct: 0, explanation: 'A haircut is a service, and paying uses money to buy it.' },
    { prompt: 'Why might people agree to use money when buying?', answers: ['It gives buyers and sellers a common way to exchange', 'It means all items cost the same', 'It makes trading goods impossible'], correct: 0, explanation: 'Money is commonly accepted in exchange for many different goods and services.' },
    { prompt: 'Which trade does not use money?', answers: ['Trading a puzzle for a ball', 'Paying $3 for a book', 'Buying bread with a coin'], correct: 0, explanation: 'Exchanging one good directly for another is bartering.' },
    { prompt: 'If a shopkeeper accepts money for a toy, the toy is…', answers: ['A good', 'A service', 'Income'], correct: 0, explanation: 'A toy is a physical item, so it is a good.' },
  ],
  'practice-goods': [
    { prompt: 'Emma bought a backpack for school. What did she buy?', answers: ['A good', 'A service'], correct: 0, explanation: 'A backpack is something you can touch.' },
    { prompt: 'Noah went to the dentist. What did Noah receive?', answers: ['A good', 'A service'], correct: 1, explanation: 'The dentist is helping Noah, which is a service.' },
    { prompt: 'Which statement is true?', answers: ['Goods are jobs people do', 'Services are things you can hold', 'Goods are things you can touch'], correct: 2, explanation: 'Goods are physical objects.' },
    { prompt: 'A library book is which kind of thing?', answers: ['A service', 'A good', 'Income'], correct: 1, explanation: 'A book is a physical object you can touch.' },
    { prompt: 'A mechanic fixes a bicycle. The repair is…', answers: ['A service', 'A good', 'A want'], correct: 0, explanation: 'The repair is work the mechanic does to help someone.' },
    { prompt: 'Which one is a good?', answers: ['A swimming lesson', 'A bus ride', 'A pair of shoes'], correct: 2, explanation: 'Shoes are objects that people can touch and own.' },
    { prompt: 'What do services describe?', answers: ['Helpful work people do', 'Things that grow in a garden', 'Coins and bills'], correct: 0, explanation: 'A service is helpful work provided by another person.' },
    { prompt: 'A music teacher gives a lesson. The lesson is…', answers: ['A service', 'A good', 'A coin'], correct: 0, explanation: 'Teaching is work that helps someone learn, so it is a service.' },
    { prompt: 'Which is something you can hold and take home?', answers: ['A loaf of bread', 'A swimming lesson', 'A bus ride'], correct: 0, explanation: 'Bread is a physical item, so it is a good.' },
    { prompt: 'Money can buy a bicycle and pay for a repair. What are these?', answers: ['A good and a service', 'Two services', 'Two kinds of income'], correct: 0, explanation: 'A bicycle is a good, and repairing it is a service.' },
    { prompt: 'A haircut is different from a hat because…', answers: ['A haircut is work; a hat is an object', 'A hat is income', 'Both are money'], correct: 0, explanation: 'The haircut is a service someone does; the hat is a physical good.' },
    { prompt: 'Which worker provides a service?', answers: ['A dentist helping a patient', 'A toy sitting on a shelf', 'A book in a bag'], correct: 0, explanation: 'The dentist provides helpful care, which is a service.' },
  ],
  'practice-needs': [
    { prompt: 'Which one is a need?', answers: ['Video game', 'Apple', 'Candy', 'Teddy bear'], correct: 1, explanation: 'Food helps us stay healthy.' },
    { prompt: 'Liam has enough money for one item. What should he buy?', answers: ['Candy', 'Sandwich'], correct: 1, explanation: 'Food is a need. Candy is a want.' },
    { prompt: 'Which shopping list is the best choice?', answers: ['Apples, milk, bread, clothes', 'Candy, video game, teddy bear, ice cream'], correct: 0, explanation: 'Needs should come before wants.' },
    { prompt: 'Which is a want?', answers: ['A safe place to sleep', 'A birthday balloon', 'Healthy food'], correct: 1, explanation: 'A balloon is enjoyable but is not needed for health or safety.' },
    { prompt: 'A child needs a raincoat and wants a toy. What should be planned first?', answers: ['The raincoat', 'The toy'], correct: 0, explanation: 'A raincoat can protect the child, so it is a need.' },
    { prompt: 'Which item helps people stay healthy?', answers: ['Fresh food', 'A game console', 'A sticker book'], correct: 0, explanation: 'Food is a need because it helps people stay healthy.' },
    { prompt: 'A want is something you…', answers: ['must have to stay safe', 'would like but can live without', 'use instead of money'], correct: 1, explanation: 'Wants are nice to have, but they are not required to live.' },
    { prompt: 'You have money for a warm jacket or a toy. It is cold outside. What should come first?', answers: ['The warm jacket', 'The toy'], correct: 0, explanation: 'A warm jacket protects you from cold, so it supports a need.' },
    { prompt: 'Which is usually a want?', answers: ['A new video game', 'Drinking water', 'A safe place to sleep'], correct: 0, explanation: 'A video game can be fun, but it is not required for health or safety.' },
    { prompt: 'What does it mean to put needs first?', answers: ['Plan for health and safety before extras', 'Buy every toy first', 'Never make a plan'], correct: 0, explanation: 'Needs support health and safety, so it is wise to plan for them before wants.' },
    { prompt: 'Which choice is a need for staying healthy?', answers: ['Nutritious food', 'A toy robot', 'A sticker collection'], correct: 0, explanation: 'Nutritious food helps the body stay healthy.' },
    { prompt: 'A bicycle may be a savings goal after important needs are covered. It is likely a…', answers: ['Want', 'Service', 'Kind of income'], correct: 0, explanation: 'A bicycle can be a fun goal to save for after important needs are covered.' },
  ],
  'chapter-quiz': [
    { prompt: 'What is money used for?', answers: ['Buying things', 'Building houses', 'Playing games'], correct: 0, explanation: 'Money helps people buy goods and services.' },
    { prompt: 'Which one is a good?', answers: ['Haircut', 'Doctor visit', 'Apple', 'Teaching'], correct: 2, explanation: 'An apple is something you can touch.' },
    { prompt: 'Which example shows bartering?', answers: ['Buying a bike with money', 'Trading apples for bread', 'Saving money'], correct: 1, explanation: 'Bartering means trading without money.' },
    { prompt: 'Which list has only wants?', answers: ['Water and bread', 'Candy and teddy bear', 'Clothes and milk'], correct: 1, explanation: 'Candy and a teddy bear are wants.' },
    { prompt: 'What can money buy?', answers: ['Goods and services', 'Only food', 'Only toys'], correct: 0, explanation: 'Money can pay for both physical goods and helpful services.' },
    { prompt: 'Which choice is bartering?', answers: ['Buying a hat with a coin', 'Trading a drawing for a storybook', 'Putting money in a bank'], correct: 1, explanation: 'Bartering is exchanging items directly without money.' },
    { prompt: 'Which is a service?', answers: ['A teacher giving a lesson', 'A new pencil', 'A loaf of bread'], correct: 0, explanation: 'Teaching is work that helps another person learn.' },
    { prompt: 'Why do people use money instead of only trading?', answers: ['It makes exchanging easier', 'It makes every choice a need', 'It turns services into goods'], correct: 0, explanation: 'Money gives people a simpler way to exchange for many things.' },
    { prompt: 'Which item is a need?', answers: ['Clean drinking water', 'A toy train', 'A comic book'], correct: 0, explanation: 'Clean water is needed to stay healthy.' },
    { prompt: 'What is a good?', answers: ['A haircut', 'A bicycle', 'A music lesson'], correct: 1, explanation: 'A bicycle is a physical object that can be touched.' },
    { prompt: 'Which is the best example of income?', answers: ['Money earned for doing a job', 'A toy someone wants', 'Trading an apple for bread'], correct: 0, explanation: 'Income is money people earn by working.' },
    { prompt: 'Which choice should usually come before a want?', answers: ['A need', 'A second toy', 'A treat'], correct: 0, explanation: 'People should plan for important needs before optional wants.' },
    { prompt: 'Which action is saving?', answers: ['Keeping some money for later', 'Trading a book for a ball', 'Paying for lunch'], correct: 0, explanation: 'Saving means setting money aside to use in the future.' },
    { prompt: 'What is a service?', answers: ['Work that helps someone', 'A coin in a pocket', 'A toy on a shelf'], correct: 0, explanation: 'A service is helpful work provided by a person.' },
    { prompt: 'Which example uses money instead of bartering?', answers: ['Paying for a bus ride', 'Trading a sandwich for a cookie', 'Swapping crayons'], correct: 0, explanation: 'Paying for a bus ride uses money to buy a service.' },
    { prompt: 'Why should a learner compare needs and wants?', answers: ['To plan money for important things first', 'To make all choices cost nothing', 'To avoid learning about money'], correct: 0, explanation: 'Thinking about needs and wants helps people make thoughtful spending choices.' },
    { prompt: 'Which statement about income is true?', answers: ['People can earn it by working', 'It means trading without money', 'It is always a toy'], correct: 0, explanation: 'Income is money a person receives for work.' },
  ],
  'chapter-test': [
    { prompt: 'Why did people stop using bartering as much?', answers: ['Trading did not always work', 'Apples disappeared', 'Money was heavier'], correct: 0, explanation: 'Sometimes a person did not want what you had to trade.' },
    { prompt: 'At a restaurant, what are you paying for?', answers: ['Only the chair', 'A hamburger and a chef cooking', 'Only a window'], correct: 1, explanation: 'The hamburger is a good and cooking is a service.' },
    { prompt: 'You have $5. Which is the smartest choice?', answers: ['Buy lunch', 'Buy candy'], correct: 0, explanation: 'Lunch is a need, so it comes first.' },
    { prompt: 'Which sentence best describes money?', answers: ['Money helps people buy goods and services', 'Money is only coins', 'Money grows on trees'], correct: 0, explanation: 'Money can be coins, bills, or other ways to exchange value.' },
    { prompt: 'What is bartering?', answers: ['Trading without money', 'Saving money for later', 'Earning money at work'], correct: 0, explanation: 'Bartering means trading one item or service for another without money.' },
    { prompt: 'Which is a good?', answers: ['A piano lesson', 'A haircut', 'A lunchbox'], correct: 2, explanation: 'A lunchbox is a physical object that can be touched.' },
    { prompt: 'Which is a service?', answers: ['A doctor checkup', 'A pair of socks', 'An orange'], correct: 0, explanation: 'A doctor provides helpful work, which is a service.' },
    { prompt: 'Why can money make trading easier?', answers: ['A seller can accept it from many buyers', 'It makes everyone want the same things', 'It means goods have no value'], correct: 0, explanation: 'Money is a common way to exchange value, even when people want different goods.' },
    { prompt: 'Which item is a need for health?', answers: ['Nutritious food', 'A video game', 'A fancy sticker'], correct: 0, explanation: 'Nutritious food helps people stay healthy, so it is a need.' },
    { prompt: 'Which is most likely a want?', answers: ['A safe home', 'A warm jacket in winter', 'A toy dinosaur'], correct: 2, explanation: 'A toy dinosaur is enjoyable but not needed for safety or health.' },
    { prompt: 'A worker earns money for cleaning a park. This money is…', answers: ['Income', 'A barter', 'A good'], correct: 0, explanation: 'Income is money earned by working.' },
    { prompt: 'Which choice is both a good and something money can buy?', answers: ['A storybook', 'A haircut', 'A tutoring lesson'], correct: 0, explanation: 'A storybook is a physical good that can be purchased with money.' },
    { prompt: 'Someone pays a plumber to fix a sink. The plumbing repair is…', answers: ['A service', 'A want', 'A coin'], correct: 0, explanation: 'The plumber is doing helpful work, so the repair is a service.' },
    { prompt: 'You have money for lunch or a toy. What is a smart first choice?', answers: ['Lunch', 'The toy'], correct: 0, explanation: 'Lunch is a need, so it should come before an optional toy.' },
    { prompt: 'Which example shows money, not bartering?', answers: ['Paying a dollar for a pencil', 'Trading a pencil for an apple', 'Swapping a book for a ball'], correct: 0, explanation: 'Paying a dollar uses money; the other choices trade goods directly.' },
    { prompt: 'What is one reason a barter trade might fail?', answers: ['The other person may not want your item', 'Money is used by both people', 'A service is helpful'], correct: 0, explanation: 'A direct trade only works when both people want the offered items.' },
    { prompt: 'Which statement about needs and wants is true?', answers: ['Needs support health and safety; wants are extras', 'All wants are needs', 'Needs are always toys'], correct: 0, explanation: 'Needs help us live safely and stay healthy; wants are things we would like.' },
    { prompt: 'Which item could be a savings goal after needs are planned for?', answers: ['A bicycle', 'Clean drinking water', 'A safe home'], correct: 0, explanation: 'A bicycle can be a personal goal to save for after essential needs are covered.' },
    { prompt: 'What does a worker receive as income?', answers: ['Money earned for work', 'A direct trade', 'A service they buy'], correct: 0, explanation: 'Income is money received in return for work.' },
    { prompt: 'A family pays someone to mow their lawn. What are they buying?', answers: ['A service', 'A good', 'A need every time'], correct: 0, explanation: 'Mowing is helpful work provided by another person, so it is a service.' },
    { prompt: 'Which example is a good?', answers: ['A carton of milk', 'A music lesson', 'A haircut'], correct: 0, explanation: 'A carton of milk is a physical item that can be held.' },
    { prompt: 'Why is it helpful to make a spending plan?', answers: ['It helps cover needs and work toward goals', 'It makes money unlimited', 'It turns wants into income'], correct: 0, explanation: 'A plan helps people use money thoughtfully for important needs and future goals.' },
    { prompt: 'Which example shows bartering for a service?', answers: ['Trading yard work for a bike repair', 'Paying a coin for an apple', 'Saving a dollar'], correct: 0, explanation: 'Exchanging work directly for a repair is a trade without money.' },
    { prompt: 'What can a person do with money they do not need to spend today?', answers: ['Save it for later', 'Throw it away', 'Trade it for every item in a shop'], correct: 0, explanation: 'Saving keeps money available for a future need or goal.' },
    { prompt: 'Which choice is a need before buying an optional toy?', answers: ['A warm winter coat', 'A second game', 'A toy dinosaur'], correct: 0, explanation: 'A warm coat helps protect health and safety, so it is a need.' },
  ],
}

export default function ChapterOne({ learnerName, completed, xp, coins, savingsGoal, selectedActivity, learningState, onSelectActivity, onComplete, onSaveQuestionProgress, onSaveActivityProgress }: ChapterOneProps) {
  const firstIncomplete = course.find((item) => item.reward && !completed.includes(item.id)) ?? course[course.length - 1]
  const requestedIndex = course.findIndex((item) => item.id === selectedActivity)
  const priorRequired = requestedIndex > 0 ? [...course.slice(0, requestedIndex)].reverse().find((item) => item.reward) : undefined
  const initialActivity = priorRequired && !completed.includes(priorRequired.id) ? firstIncomplete.id : selectedActivity
  const [selectedId, setSelectedId] = useState(initialActivity)
  const [menuOpen, setMenuOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 760)
  const selected = course.find((item) => item.id === selectedId) ?? course[0]
  const done = completed.includes(selectedId)
  const chapterComplete = course.filter((item) => item.reward).every((item) => completed.includes(item.id))
  const select = (id: string) => {
    const index = course.findIndex((item) => item.id === id)
    const previous = index > 0 ? [...course.slice(0, index)].reverse().find((item) => item.reward) : undefined
    if (previous && !completed.includes(previous.id)) return
    setSelectedId(id)
    onSelectActivity(id)
  }
  const finish = async (activity = selected.reward) => activity ? onComplete(activity) : true
  const explainWord = (event: React.MouseEvent<HTMLDivElement>) => {
    const word = (event.target as HTMLElement).closest('.word-link')?.textContent?.toLowerCase()
    const definitions: Record<string, string> = {
      bartering: 'Bartering means trading one thing for another without using money.',
      good: 'A good is something you can touch, hold, and buy.',
      service: 'A service is helpful work someone does for another person.',
    }
    if (word && definitions[word]) readAloud(definitions[word])
  }
  const advance = () => {
    const index = course.findIndex((item) => item.id === selectedId)
    if (index < course.length - 1) {
      const next = course[index + 1]
      setSelectedId(next.id)
      onSelectActivity(next.id)
    }
  }
  return <div className="chapter-shell" onClick={explainWord}>
    <header className="chapter-header"><button className="chapter-menu" onClick={() => setMenuOpen((value) => !value)} aria-label="Toggle course map">☰</button><div><span>GRADE 1 / CHAPTER 1</span><strong>What is money?</strong></div><div className="reward-totals"><span>⭐ {xp} XP</span><span>🪙 {coins}</span></div></header>
    <div className="chapter-layout">
      <aside className={`chapter-map ${menuOpen ? '' : 'chapter-map-collapsed'}`} aria-hidden={!menuOpen}><div><p>CHAPTER PROGRESS</p><strong>{completed.filter((id) => course.some((item) => item.id === id)).length} / {course.length - 1} complete</strong></div>{course.map((item, index) => {
        const previous = index > 0 ? [...course.slice(0, index)].reverse().find((entry) => entry.reward) : undefined
        const locked = Boolean(previous && !completed.includes(previous.id)) || (item.id === 'completion' && !chapterComplete)
        return <button key={item.id} className={item.id === selectedId ? 'selected' : ''} onClick={() => select(item.id)} disabled={locked} aria-current={item.id === selectedId ? 'step' : undefined}><span className={completed.includes(item.id) ? 'is-complete' : ''}>{completed.includes(item.id) ? '✓' : index + 1}</span><small>{item.label}</small><strong>{item.title}</strong></button>
      })}</aside>
      <main className="chapter-content"><div className="chapter-breadcrumb">Grade 1 <b>/</b> Money Basics <b>/</b> {selected.label}</div><Content item={selected} learnerName={learnerName} savingsGoal={savingsGoal} xp={xp} coins={coins} chapterComplete={chapterComplete} learningState={learningState} onSelectActivity={select} onFinish={finish} onAdvance={advance} onSaveQuestionProgress={onSaveQuestionProgress} onSaveActivityProgress={onSaveActivityProgress} done={done} completedCount={completed.length} /></main>
    </div>
  </div>
}

function Content({ item, learnerName, savingsGoal, xp, coins, chapterComplete, learningState, onSelectActivity, onFinish, onAdvance, onSaveQuestionProgress, onSaveActivityProgress, done, completedCount }: { item: CourseItem; learnerName: string; savingsGoal?: { goal: string; plan: string } | null; xp: number; coins: number; chapterComplete: boolean; learningState: LearningState; onSelectActivity: (id: string) => void; onFinish: (activity?: ActivityProgress) => Promise<boolean>; onAdvance: () => void; onSaveQuestionProgress: (activityId: string, progress: QuestionProgress) => void; onSaveActivityProgress: (activityId: string, progress: ActivityState) => void; done: boolean; completedCount: number }) {
  const completeAndAdvance = async (activity?: ActivityProgress) => { if (await onFinish(activity)) onAdvance() }
  if (item.id === 'welcome') return <Welcome learnerName={learnerName} started={done || completedCount > 0} onStart={completeAndAdvance} />
  if (item.id === 'vocabulary') return <Vocabulary savedState={learningState.activityProgress.vocabulary} onSaveProgress={onSaveActivityProgress} onFinish={completeAndAdvance} />
  if (item.id.startsWith('video-')) return <Video id={item.id} title={item.title} onFinish={completeAndAdvance} done={done} savedState={learningState.activityProgress[item.id]} onSaveProgress={onSaveActivityProgress} />
  if (item.id.startsWith('check-')) return <QuestionSet activityId={item.id} title={item.title} questions={checks[item.id]} target={4} savedProgress={learningState.questionProgress[item.id]} done={done} onSaveProgress={onSaveQuestionProgress} finishText="Complete quick check" onFinish={() => {
    if (done) { onAdvance(); return Promise.resolve() }
    return completeAndAdvance()
  }} />
  if (item.id.startsWith('article-')) return <Article id={item.id} savedState={learningState.activityProgress[item.id]} onSaveProgress={onSaveActivityProgress} onFinish={completeAndAdvance} />
  if (item.id === 'barter') return <ArcadeGame key={item.id} game={arcadeGames.barter} savedState={learningState.activityProgress.barter} done={done} onSaveProgress={onSaveActivityProgress} onFinish={completeAndAdvance} />
  if (item.id === 'sort') return <ArcadeGame key={item.id} game={arcadeGames.sort} savedState={learningState.activityProgress.sort} done={done} onSaveProgress={onSaveActivityProgress} onFinish={completeAndAdvance} />
  if (item.id === 'needs-game') return <ArcadeGame key={item.id} game={arcadeGames['needs-game']} savedState={learningState.activityProgress['needs-game']} done={done} onSaveProgress={onSaveActivityProgress} onFinish={completeAndAdvance} />
  if (item.id.startsWith('practice-') || item.id === 'chapter-quiz' || item.id === 'chapter-test') return <QuestionSet activityId={item.id} title={item.title} questions={assessments[item.id]} target={item.id === 'chapter-test' ? 10 : 4} savedProgress={learningState.questionProgress[item.id]} done={done} onSaveProgress={onSaveQuestionProgress} finishText={item.id === 'chapter-test' ? 'Finish final test' : 'Submit answers'} onFinish={() => {
    if (done) { onAdvance(); return Promise.resolve() }
    return completeAndAdvance(item.id === 'chapter-quiz' || item.id === 'chapter-test' ? { ...item.reward!, score: 100 } : undefined)
  }} />
  if (item.id === 'review') return <Review onFinish={completeAndAdvance} />
  if (item.id === 'final-project') return <SavingsProject savedGoal={savingsGoal} savedState={learningState.activityProgress['final-project']} onSaveProgress={onSaveActivityProgress} onFinish={completeAndAdvance} />
  return chapterComplete ? <Completion learnerName={learnerName} xp={xp} coins={coins} /> : <section className="learning-page"><p className="eyebrow-label">CHAPTER PROGRESS</p><h1>Keep learning to unlock your celebration.</h1><p className="page-intro">Complete all 20 chapter activities first. Your progress and rewards are saved as you go.</p><button className="primary-course-button" onClick={() => onSelectActivity('welcome')}>Return to chapter activities →</button></section>
}

function Penny({ children }: { children: React.ReactNode }) { return <aside className="penny-tip"><span>🐷</span><div><b>Penny says</b><p>{children}</p></div></aside> }

function Welcome({ learnerName, started, onStart }: { learnerName: string; started: boolean; onStart: () => void }) { return <><section className="chapter-hero"><div><p>WELCOME, MONEY EXPLORER</p><h1>Hi, {learnerName}! Let’s learn about money.</h1><span>Why do people use money? What happened before money existed? You’re about to discover the answers.</span><button onClick={() => onStart()}>{started ? 'Keep Learning!' : 'Start Chapter 1'} <b>→</b></button></div><div className="penny-hero" aria-label="Penny the piggy bank mascot">🐷<i>✦</i></div></section><section className="chapter-info-grid"><article><span>🎯</span><h2>What you’ll learn</h2><p>Explain money and bartering, identify goods and services, tell needs from wants, and make smart choices.</p></article><article><span>📋</span><h2>Chapter overview</h2><p>Videos, articles, games, practice checks, a chapter assessment, final test, and a savings project.</p></article><article><span>⏱</span><h2>Take your time</h2><p>This chapter takes about 2–3 hours. Most learners finish it over 3–5 days.</p></article></section><Penny>Long before money existed, people traded things with each other. Imagine trading your favorite toy for a sandwich!</Penny><section className="mission"><p>CHAPTER MISSION</p><h2>Why do people use money?</h2><span>Keep this question in your mind as you explore every activity.</span></section><section className="parent-corner"><b>For parents and guardians</b><p>This chapter introduces money through stories, games, and real-life examples. A short conversation at home can help make the ideas stick.</p></section></> }

function readAloud(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return false
  const speech = window.speechSynthesis
  const utterance = new SpeechSynthesisUtterance(text)
  const voice = speech.getVoices().find((item) => item.lang.toLowerCase().startsWith('en'))
  if (voice) utterance.voice = voice
  utterance.lang = 'en-US'
  utterance.rate = 0.9
  speech.cancel()
  speech.speak(utterance)
  return true
}

function parseSavedOrder(value: unknown, length: number) {
  if (typeof value === 'string') {
    const order = value.split(',').map(Number)
    if (order.length === length && new Set(order).size === length && order.every((entry) => Number.isInteger(entry) && entry >= 0 && entry < length)) return order
  }
  return shuffleIndexes(length)
}

function Vocabulary({ savedState, onSaveProgress, onFinish }: { savedState?: ActivityState; onSaveProgress: (activityId: string, progress: ActivityState) => void; onFinish: () => void }) {
  const savedIndex = typeof savedState?.index === 'number' && savedState.index >= 0 && savedState.index < vocabulary.length ? savedState.index : 0
  const [wordOrder] = useState(() => parseSavedOrder(savedState?.wordOrder, vocabulary.length))
  const [answerOrder, setAnswerOrder] = useState(() => parseSavedOrder(savedState?.answerOrder, 3))
  const [index, setIndex] = useState(savedIndex)
  const [choice, setChoice] = useState<string | null>(typeof savedState?.choice === 'string' ? savedState.choice : null)
  const [checked, setChecked] = useState(savedState?.checked === true)
  const [speechUnavailable, setSpeechUnavailable] = useState(false)
  const savedInitialOrder = useRef(false)
  const word = vocabulary[wordOrder[index]]
  const distractors = vocabulary.filter((entry) => entry[4] !== word[4])
  const choices = [word[4], distractors[index % distractors.length][4], distractors[(index + 1) % distractors.length][4]]
  const isCorrect = choice === word[4]
  useEffect(() => {
    if (savedInitialOrder.current || (typeof savedState?.wordOrder === 'string' && typeof savedState.answerOrder === 'string')) return
    savedInitialOrder.current = true
    onSaveProgress('vocabulary', { index, choice, checked, wordOrder: wordOrder.join(','), answerOrder: answerOrder.join(',') })
  }, [answerOrder, checked, choice, index, onSaveProgress, savedState?.answerOrder, savedState?.wordOrder, wordOrder])
  const save = (nextIndex: number, nextChoice: string | null, nextChecked: boolean, nextAnswerOrder = answerOrder) => {
    setIndex(nextIndex)
    setChoice(nextChoice)
    setChecked(nextChecked)
    setAnswerOrder(nextAnswerOrder)
    onSaveProgress('vocabulary', { index: nextIndex, choice: nextChoice, checked: nextChecked, wordOrder: wordOrder.join(','), answerOrder: nextAnswerOrder.join(',') })
  }
  const next = () => {
    if (index === vocabulary.length - 1) onFinish()
    else save(index + 1, null, false, shuffleIndexes(3))
  }
  return <section className="learning-page"><p className="eyebrow-label">VOCABULARY · {index + 1} OF {vocabulary.length}</p><h1>Money words</h1><p className="page-intro">Read the word, listen to it, and choose the example that matches. The cards appear in a new order each time.</p><div className="question-progress" aria-label={`${index} of ${vocabulary.length} words explored`}><i style={{ width: `${(index / vocabulary.length) * 100}%` }} /></div><div className="vocabulary-card"><div className="word-art">{word[3]}</div><div><p className="eyebrow-label">WORD {index + 1}</p><h2>{word[0]}</h2><p className="definition">{word[1]}</p><p><b>Example:</b> {word[2]}</p><button className="audio-button" onClick={() => setSpeechUnavailable(!readAloud(`${word[0]}. ${word[1]} Example: ${word[2]}`))}>🔊 Hear this word</button>{speechUnavailable && <small role="status">Read-aloud is not available in this browser.</small>}</div></div><div className="mini-question"><p>Which example matches <b>{word[0]}</b>?</p><div className="vocabulary-choices">{answerOrder.map((choiceIndex, position) => <button disabled={checked && isCorrect} className={choice === choices[choiceIndex] ? 'selected' : ''} key={`${index}-${choices[choiceIndex]}`} onClick={() => save(index, choices[choiceIndex], false)}><b>{String.fromCharCode(65 + position)}</b>{choices[choiceIndex]}</button>)}</div>{checked && <p className={`vocabulary-feedback ${isCorrect ? 'correct' : 'retry'}`} role="status">{isCorrect ? 'That is right! You unlocked the next word.' : `“${choice}” is not an example of ${word[0].toLowerCase()}. ${word[1]}`}</p>}{checked && isCorrect && <button className="primary-course-button" onClick={next}>{index === vocabulary.length - 1 ? 'Complete vocabulary' : 'Next word'} →</button>}{(!checked || !isCorrect) && <button className="primary-course-button check-answer-button" disabled={!choice} onClick={() => save(index, choice, true)}>Check answer <span aria-hidden="true">✓</span></button>}</div></section>
}

function Video({ id, title, onFinish, done, savedState, onSaveProgress }: { id: string; title: string; onFinish: () => void; done: boolean; savedState?: ActivityState; onSaveProgress: (activityId: string, progress: ActivityState) => void }) {
  const playerContainer = useRef<HTMLDivElement>(null)
  const saveProgressRef = useRef(onSaveProgress)
  const startAt = typeof savedState?.seconds === 'number' ? savedState.seconds : 0
  const startAtRef = useRef(startAt)

  useEffect(() => {
    saveProgressRef.current = onSaveProgress
  }, [onSaveProgress])

  useEffect(() => {
    startAtRef.current = startAt
  }, [startAt])

  useEffect(() => {
    let cancelled = false
    let player: YouTubePlayerInstance | undefined
    let apiTimer: number | undefined
    let progressTimer: number | undefined
    let lastSavedSecond = startAtRef.current
    const saveTime = (seconds: number) => {
      const position = Math.floor(seconds)
      if (position > 0 && position !== lastSavedSecond) {
        lastSavedSecond = position
        saveProgressRef.current(id, { seconds: position })
      }
    }
    const initializePlayer = () => {
      const youtube = window.YT
      if (cancelled || !youtube?.Player || !playerContainer.current) return false
      player = new youtube.Player(playerContainer.current, {
        videoId: videoLinks[id],
        playerVars: { rel: 0 },
        events: {
          onReady: ({ target }) => {
            player = target
            if (startAtRef.current > 0) target.seekTo(startAtRef.current, true)
            progressTimer = window.setInterval(() => saveTime(target.getCurrentTime()), 5000)
          },
        },
      })
      return true
    }

    if (!initializePlayer()) {
      let script = document.getElementById('youtube-iframe-api') as HTMLScriptElement | null
      if (!script) {
        script = document.createElement('script')
        script.id = 'youtube-iframe-api'
        script.src = 'https://www.youtube.com/iframe_api'
        document.head.append(script)
      }
      apiTimer = window.setInterval(() => {
        if (initializePlayer() && apiTimer !== undefined) window.clearInterval(apiTimer)
      }, 100)
    }

    return () => {
      cancelled = true
      if (apiTimer !== undefined) window.clearInterval(apiTimer)
      if (progressTimer !== undefined) window.clearInterval(progressTimer)
      if (player) {
        saveTime(player.getCurrentTime())
        player.destroy()
      }
    }
  }, [id])

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
  return <section className="learning-page video-page"><p className="eyebrow-label">VIDEO LESSON · 3–5 MINUTES</p><h1>{title}</h1><div className="video-frame"><div ref={playerContainer} title={title} /></div>{startAt > 0 && <p className="page-intro">Your video will resume near {formatTime(startAt)}.</p>}<Penny>Watch closely, then try the quick check. Your place in the video is saved as you watch.</Penny><button className="primary-course-button" onClick={() => onFinish()}>{done ? 'Watched ✓' : 'I watched the video'} →</button></section>
}

function shuffleIndexes(length: number, exclude: number[] = []) {
  const values = Array.from({ length }, (_, index) => index).filter((index) => !exclude.includes(index))
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[values[index], values[swapIndex]] = [values[swapIndex], values[index]]
  }
  return values
}

function QuestionSet({ activityId, title, questions, target, savedProgress, done, onSaveProgress, finishText, onFinish }: { activityId: string; title: string; questions: Question[]; target: number; savedProgress?: QuestionProgress; done: boolean; onSaveProgress: (activityId: string, progress: QuestionProgress) => void; finishText: string; onFinish: () => Promise<void> }) {
  const initialProgress = (): QuestionProgress => {
    const saved = savedProgress
    const validOrder = saved?.order.filter((index) => Number.isInteger(index) && index >= 0 && index < questions.length) ?? []
    if (saved && validOrder.length && saved.index < validOrder.length) {
      const currentQuestion = questions[validOrder[saved.index]]
      const validAnswers = saved.answerOrder?.filter((index) => Number.isInteger(index) && index >= 0 && index < currentQuestion.answers.length)
      const hasValidAnswerOrder = validAnswers?.length === currentQuestion.answers.length && new Set(validAnswers).size === currentQuestion.answers.length
      return { ...saved, order: validOrder, seen: saved.seen.filter((index) => index >= 0 && index < questions.length), answerOrder: hasValidAnswerOrder ? validAnswers : shuffleIndexes(currentQuestion.answers.length) }
    }
    return { order: shuffleIndexes(questions.length), index: 0, seen: [], streak: 0, choice: null, result: null, answerOrder: shuffleIndexes(questions[0].answers.length) }
  }
  const [progress, setProgress] = useState<QuestionProgress>(initialProgress)
  const question = questions[progress.order[progress.index]]
  const updateProgress = (next: QuestionProgress) => {
    setProgress(next)
    onSaveProgress(activityId, next)
  }
  const submit = () => {
    if (progress.choice === null || progress.result !== null) return
    const questionIndex = progress.order[progress.index]
    const isCorrect = progress.choice === question.correct
    updateProgress({
      ...progress,
      seen: progress.seen.includes(questionIndex) ? progress.seen : [...progress.seen, questionIndex],
      streak: isCorrect ? progress.streak + 1 : 0,
      result: isCorrect,
    })
  }
  const next = () => {
    if (progress.streak >= target) { void onFinish(); return }
    let order = progress.order
    let index = progress.index + 1
    if (index >= order.length) {
      order = shuffleIndexes(questions.length, progress.seen)
      if (!order.length) order = shuffleIndexes(questions.length)
      index = 0
    }
    updateProgress({ ...progress, order, index, choice: null, result: null, answerOrder: shuffleIndexes(questions[order[index]].answers.length) })
  }
  const questionNumber = progress.result === true ? progress.streak : progress.result === false ? 1 : progress.streak + 1
  return <section className="learning-page assessment-page"><p className="eyebrow-label">{title.toUpperCase()} · QUESTION {questionNumber} OF {target} TO MASTER</p><div className="question-progress" aria-label={`${progress.streak} of ${target} correct in a row`}><i style={{ width: `${Math.min((progress.streak / target) * 100, 100)}%` }} /></div><p className="mastery-counter" aria-live="polite"><span>🔥</span> {progress.streak} of {target} correct in a row</p><Penny>Get {target} in a row right to continue. A missed answer resets your streak, and each question is new.</Penny><div className="question-card"><span className="question-card-number">QUESTION {questionNumber}</span><h1>{question.prompt}</h1><p>Choose one answer, then check it when you’re ready.</p></div><div className="answer-list" role="group" aria-label="Answer choices">{(progress.answerOrder ?? question.answers.map((_, index) => index)).map((answerIndex, position) => <button type="button" disabled={progress.result !== null} aria-pressed={progress.choice === answerIndex} className={`${progress.choice === answerIndex ? 'chosen' : ''} ${progress.result !== null && answerIndex === question.correct ? 'answer-correct' : ''} ${progress.result === false && progress.choice === answerIndex ? 'answer-incorrect' : ''}`} onClick={() => updateProgress({ ...progress, choice: answerIndex })} key={answerIndex}><b>{String.fromCharCode(65 + position)}</b><span>{question.answers[answerIndex]}</span><i aria-hidden="true">{progress.choice === answerIndex ? '✓' : ''}</i></button>)}</div>{progress.result !== null && <div className={progress.result ? 'feedback correct' : 'feedback retry'} role="status"><strong>{progress.result ? 'Excellent work!' : 'Not quite — a fresh question is coming up.'}</strong><p>{progress.result ? question.explanation : `“${question.answers[progress.choice ?? 0]}” is not the best answer. ${question.explanation} The correct answer is “${question.answers[question.correct]}.”`}</p></div>}<div className="assessment-controls">{progress.result !== null ? <button className="primary-course-button" onClick={next}>{progress.streak >= target ? finishText : 'Next question'} →</button> : <button className="primary-course-button check-answer-button" disabled={progress.choice === null} onClick={submit}>Check my answer <span aria-hidden="true">✓</span></button>}</div>{done && <p className="page-intro">This activity is already complete. Review it if you like; rewards are only collected once.</p>}</section>
}

function Article({ id, savedState, onSaveProgress, onFinish }: { id: string; savedState?: ActivityState; onSaveProgress: (activityId: string, progress: ActivityState) => void; onFinish: () => void }) {
  const money = id === 'article-1'
  const [reflection, setReflection] = useState(typeof savedState?.reflection === 'string' ? savedState.reflection : '')
  const readAloudText = money
    ? 'Have you ever gone to a store with your family? Maybe you bought a toy, a snack, or a new book. Your family used money. Money helps people buy the things they need and the things they want. Long ago, people traded things instead of using money. This was called bartering. Money makes life easier because everyone can use it to exchange goods and services.'
    : 'A good is something you can touch, hold in your hands, and take home. Apples, books, toys, bicycles, and clothes are goods. A service is work someone does for another person. Teachers, doctors, haircuts, and firefighters are examples. Money can buy both goods and services.'
  const saveReflection = () => onSaveProgress(id, { reflection })

  return <article className="article-page">
    <header>
      <p className="eyebrow-label">ARTICLE · 2–3 MINUTES · BEGINNER</p>
      <h1>{money ? 'Why do we use money?' : 'Goods vs. services'}</h1>
      <button className="audio-button" onClick={() => readAloud(readAloudText)}>🔊 Read aloud</button>
    </header>
    {money ? <>
      <Illustration symbols="🛒  🧸  🥖" label="A busy town where people use money" />
      <h2>What is money?</h2>
      <p>Have you ever gone to a store with your family? Maybe you bought a toy, a snack, or a new book. Your family used money. Money helps people buy the things they need and the things they want.</p>
      <h2>Long ago…</h2>
      <p>There was a time when money did not exist. People traded things instead. This was called <button className="word-link">bartering</button>. If you had apples and your friend had bread, you could trade apples for bread.</p>
      <Illustration symbols="🍎  ↔  🍞" label="Two children trading apples and bread" />
      <h2>Money makes life easier</h2>
      <p>Bartering did not always work. A shoe seller might not want apples, even if you wanted shoes. Money solved this problem because everyone could use money instead of trading.</p>
      <Penny>Money is a tool that helps people exchange goods and services.</Penny>
      <aside className="fun-fact"><b>🌟 Fun fact</b><p>The first coins were made more than 2,500 years ago!</p></aside>
    </> : <>
      <Illustration symbols="🧸  📚  |  👩‍🏫  ✂️" label="Goods on one side and helpers on the other" />
      <h2>Things we can buy</h2>
      <p>Every day, people use money to buy many different things. A <button className="word-link">good</button> is something you can touch, hold in your hands, and take home. Apples, books, toys, bicycles, and clothes are goods.</p>
      <h2>People who help us</h2>
      <p>Sometimes we spend money on something we cannot hold. Instead, someone helps us. A <button className="word-link">service</button> is work someone does for another person. Teachers, doctors, haircuts, and firefighters are examples.</p>
      <h2>Money buys both</h2>
      <p>When you buy a pizza, you are buying a good. When you pay for a haircut, you are paying for a service. Both are important.</p>
      <Penny>Ask yourself: “Can I hold it?” If yes, it is probably a good. If no, someone is probably providing a service.</Penny>
    </>}
    <section className="reflect">
      <h2>Think about it</h2>
      <p>{money ? 'Imagine there was no money today. Would trading be easy or hard?' : 'Look around your home. Can you find three goods and three services?'}</p>
      <textarea value={reflection} onChange={(event) => setReflection(event.target.value)} onBlur={saveReflection} maxLength={2000} placeholder="Type or record your idea here…" aria-label="Reflection response" />
      <small>Your reflection saves when you leave this box.</small>
    </section>
    <button className="primary-course-button" onClick={() => onFinish()}>I finished reading →</button>
  </article>
}

function Illustration({ symbols, label }: { symbols: string; label: string }) { return <div className="article-illustration" role="img" aria-label={label}>{symbols}</div> }

type ArcadeQuestion = { emoji: string; prompt: string; detail: string; answers: string[]; correct: number; explanation: string }
type ArcadeGameConfig = { id: string; title: string; badge: string; subtitle: string; instructions: string; emoji: string; questions: ArcadeQuestion[] }
const runnerObstacleDistances = [150, 340, 570, 800, 1030, 1260, 1460]
const runnerJumpWindow = 42
const runnerQuestionCheckpoints = [250, 470, 700, 930, 1160, 1350]

const arcadeGames: Record<string, ArcadeGameConfig> = {
  barter: {
    id: 'barter',
    title: 'Barter Market',
    badge: 'Barter Market Champion',
    subtitle: 'Race your delivery scooter through a bustling little town.',
    instructions: 'Answer money questions to charge your scooter. Jump over market crates, grab star-energy, and deliver every parcel!',
    emoji: '🏪',
    questions: [
      { emoji: '🍎', prompt: 'A farmer has apples and wants bread.', detail: 'The baker wants fresh apples for a pie.', answers: ['Trade apples for the baker’s bread', 'Give apples to a shoe shop', 'Keep trading apples for apples'], correct: 0, explanation: 'The baker wants apples and the farmer wants bread, so both get something they want.' },
      { emoji: '🥛', prompt: 'A dairy farmer needs a warm scarf.', detail: 'The knitter needs milk for her family.', answers: ['Trade milk for a scarf', 'Offer milk to someone who only wants shoes', 'Ask for the same milk back'], correct: 0, explanation: 'Each person wants what the other person has: this trade can work.' },
      { emoji: '🎨', prompt: 'A painter wants a basket of peaches.', detail: 'The orchard owner needs a sign painted for the stand.', answers: ['Paint a sign in exchange for peaches', 'Trade paint for more paint', 'Give peaches to a baker who wants bread'], correct: 0, explanation: 'The painter provides a service the orchard owner wants, and gets peaches.' },
      { emoji: '🧸', prompt: 'Milo has a toy car and wants a storybook.', detail: 'Lena has a storybook and would like a toy car.', answers: ['Trade the toy car for Lena’s book', 'Offer the car to someone who wants a kite', 'Wait for a coin to appear'], correct: 0, explanation: 'Milo and Lena each want the item the other person has.' },
      { emoji: '🥚', prompt: 'A chicken farmer wants a haircut.', detail: 'The barber would like fresh eggs for breakfast.', answers: ['Trade eggs for a haircut', 'Trade eggs for a bicycle ride', 'Give the eggs to someone who wants apples'], correct: 0, explanation: 'A haircut is a service, and a direct exchange can be bartering too.' },
      { emoji: '🪴', prompt: 'A gardener wants a clay pot.', detail: 'The potter is looking for a plant for the studio.', answers: ['Trade a plant for a pot', 'Trade a plant for a haircut from someone who wants bread', 'Keep the plant and ask for the same plant'], correct: 0, explanation: 'The gardener and potter each have something the other wants.' },
      { emoji: '🧣', prompt: 'A scarf maker wants fresh carrots.', detail: 'The farmer needs a warm scarf for winter.', answers: ['Trade a scarf for carrots', 'Offer a scarf to someone who wants a book', 'Ask the farmer to trade carrots for carrots'], correct: 0, explanation: 'The farmer wants the scarf and the maker wants the carrots.' },
      { emoji: '🎸', prompt: 'A musician wants a bicycle repair.', detail: 'The bike mechanic would enjoy a music lesson.', answers: ['Give a music lesson for a bike repair', 'Trade a song for a sandwich from someone who wants a toy', 'Ask the mechanic to fix a different bicycle'], correct: 0, explanation: 'Both people trade services they can provide for a service they want.' },
      { emoji: '🍯', prompt: 'A beekeeper wants a loaf of bread.', detail: 'The baker would like a jar of honey.', answers: ['Trade honey for bread', 'Trade honey for milk from someone who needs honey', 'Give honey away and hope for bread'], correct: 0, explanation: 'The baker wants honey and the beekeeper wants bread.' },
      { emoji: '🪑', prompt: 'A carpenter wants a basket of apples.', detail: 'The orchard owner needs a small wooden stool.', answers: ['Trade a stool for apples', 'Offer a stool to someone who wants a haircut', 'Keep the stool and ask for a bicycle'], correct: 0, explanation: 'The stool is a good the orchard owner wants, and the carpenter gets apples.' },
      { emoji: '🧁', prompt: 'A baker wants help carrying flour.', detail: 'A neighbor wants cupcakes for a celebration.', answers: ['Carry the flour in exchange for cupcakes', 'Trade flour for flour', 'Give cupcakes to someone who wants a haircut'], correct: 0, explanation: 'Helping carry flour is a service exchanged for a good.' },
      { emoji: '💵', prompt: 'The town’s direct trades keep getting stuck.', detail: 'People cannot always find someone who wants what they have.', answers: ['Use money to buy from different sellers', 'Only trade with one person forever', 'Stop buying goods and services'], correct: 0, explanation: 'Money makes exchanges easier because sellers can use it to buy different things.' },
    ],
  },
  sort: {
    id: 'sort',
    title: 'Goods Dash',
    badge: 'Goods Dash Champion',
    subtitle: 'Help a speedy squirrel race through the town park.',
    instructions: 'Answer goods-and-services questions to charge up. Leap over logs and race to the picnic!',
    emoji: '🛒',
    questions: [
      { emoji: '🍎', prompt: 'Fresh apple', detail: 'You can hold it and take it home.', answers: ['📦 Goods', '🤝 Services'], correct: 0, explanation: 'An apple is a physical item you can touch, so it is a good.' },
      { emoji: '💇', prompt: 'A haircut', detail: 'A stylist does helpful work for you.', answers: ['📦 Goods', '🤝 Services'], correct: 1, explanation: 'A haircut is a service because someone provides helpful work.' },
      { emoji: '📚', prompt: 'A library book to keep', detail: 'It is an item you can hold and own.', answers: ['📦 Goods', '🤝 Services'], correct: 0, explanation: 'A book is something you can hold, so it is a good.' },
      { emoji: '🩺', prompt: 'A doctor visit', detail: 'A doctor checks your health and gives care.', answers: ['📦 Goods', '🤝 Services'], correct: 1, explanation: 'Medical care is work a doctor does to help someone, so it is a service.' },
      { emoji: '🚲', prompt: 'A bicycle', detail: 'It is a thing you can ride and take home.', answers: ['📦 Goods', '🤝 Services'], correct: 0, explanation: 'A bicycle is a physical item, which makes it a good.' },
      { emoji: '🎹', prompt: 'A piano lesson', detail: 'A teacher helps you learn to play.', answers: ['📦 Goods', '🤝 Services'], correct: 1, explanation: 'Teaching a lesson is helpful work, so it is a service.' },
      { emoji: '🥪', prompt: 'A sandwich', detail: 'It is food you can eat.', answers: ['📦 Goods', '🤝 Services'], correct: 0, explanation: 'A sandwich is a physical item you can buy, so it is a good.' },
      { emoji: '🚕', prompt: 'A taxi ride', detail: 'A driver takes you where you need to go.', answers: ['📦 Goods', '🤝 Services'], correct: 1, explanation: 'The ride is work provided by a driver, so it is a service.' },
      { emoji: '👟', prompt: 'A pair of shoes', detail: 'You can wear them and take them home.', answers: ['📦 Goods', '🤝 Services'], correct: 0, explanation: 'Shoes are physical items, so they are goods.' },
      { emoji: '🧹', prompt: 'A cleaner tidies a room', detail: 'The cleaner does a helpful task.', answers: ['📦 Goods', '🤝 Services'], correct: 1, explanation: 'Cleaning is work someone does for another person, so it is a service.' },
      { emoji: '🧸', prompt: 'A teddy bear', detail: 'It is a toy you can hold.', answers: ['📦 Goods', '🤝 Services'], correct: 0, explanation: 'A teddy bear is a thing you can touch, so it is a good.' },
      { emoji: '📦', prompt: 'A delivery driver brings a parcel', detail: 'The driver brings your items to you.', answers: ['📦 Goods', '🤝 Services'], correct: 1, explanation: 'The delivery is helpful work provided by the driver, so it is a service.' },
    ],
  },
  'needs-game': {
    id: 'needs-game',
    title: 'Needs-vs-Wants Catcher',
    badge: 'Needs & Wants Hero',
    subtitle: 'Join Penny on a bouncy shopping trip.',
    instructions: 'Answer needs-and-wants questions to power up. Hop over toys and guide Penny home!',
    emoji: '🐷',
    questions: [
      { emoji: '💧', prompt: 'Clean drinking water', detail: 'Penny needs this to stay healthy.', answers: ['❤️ NEEDS basket', '⭐ WANTS basket'], correct: 0, explanation: 'Clean water keeps our bodies healthy, so it is a need.' },
      { emoji: '🎮', prompt: 'A new video game', detail: 'It would be fun to play after homework.', answers: ['❤️ NEEDS basket', '⭐ WANTS basket'], correct: 1, explanation: 'A game is enjoyable, but it is not required to stay healthy or safe.' },
      { emoji: '🏠', prompt: 'A safe place to live', detail: 'It protects Penny from weather and danger.', answers: ['❤️ NEEDS basket', '⭐ WANTS basket'], correct: 0, explanation: 'A safe home protects people, so shelter is a need.' },
      { emoji: '🍬', prompt: 'A giant bag of candy', detail: 'A sweet treat sounds delicious.', answers: ['❤️ NEEDS basket', '⭐ WANTS basket'], correct: 1, explanation: 'Candy can be a treat, but it is not needed to stay healthy.' },
      { emoji: '🥗', prompt: 'A healthy meal', detail: 'Food gives Penny energy to grow and play.', answers: ['❤️ NEEDS basket', '⭐ WANTS basket'], correct: 0, explanation: 'People need nourishing food to stay healthy.' },
      { emoji: '🛹', prompt: 'A brand-new skateboard', detail: 'Penny would like to learn a new trick.', answers: ['❤️ NEEDS basket', '⭐ WANTS basket'], correct: 1, explanation: 'A skateboard can be fun, but it is an extra rather than a need.' },
      { emoji: '🧥', prompt: 'A warm coat in winter', detail: 'It helps Penny stay warm and safe outside.', answers: ['❤️ NEEDS basket', '⭐ WANTS basket'], correct: 0, explanation: 'Weather-appropriate clothes help protect health and safety.' },
      { emoji: '✨', prompt: 'Glittery stickers', detail: 'They would decorate Penny’s notebook.', answers: ['❤️ NEEDS basket', '⭐ WANTS basket'], correct: 1, explanation: 'Stickers are a fun extra, not something people must have.' },
      { emoji: '🩹', prompt: 'Medicine from the doctor', detail: 'It helps Penny get well when she is sick.', answers: ['❤️ NEEDS basket', '⭐ WANTS basket'], correct: 0, explanation: 'Needed medicine helps protect health.' },
      { emoji: '🎈', prompt: 'A bunch of party balloons', detail: 'They would make the room festive.', answers: ['❤️ NEEDS basket', '⭐ WANTS basket'], correct: 1, explanation: 'Balloons can be fun, but a person can be safe and healthy without them.' },
      { emoji: '🛏️', prompt: 'A bed to sleep safely', detail: 'Rest helps Penny’s body stay healthy.', answers: ['❤️ NEEDS basket', '⭐ WANTS basket'], correct: 0, explanation: 'A safe place to sleep supports health and safety.' },
      { emoji: '🍦', prompt: 'An extra ice cream cone', detail: 'It would be a delicious dessert.', answers: ['❤️ NEEDS basket', '⭐ WANTS basket'], correct: 1, explanation: 'Ice cream is a treat, so it is a want rather than a need.' },
    ],
  },
}

function ArcadeGame({ game, savedState, done, onSaveProgress, onFinish }: { game: ArcadeGameConfig; savedState?: ActivityState; done: boolean; onSaveProgress: (activityId: string, progress: ActivityState) => void; onFinish: () => Promise<void> }) {
  const gameVersion = 4
  const saved = savedState?.gameVersion === gameVersion || savedState?.gameVersion === 3
  const savedNumber = (key: string, fallback: number, maximum = Number.MAX_SAFE_INTEGER) => {
    const value = saved ? savedState[key] : undefined
    return typeof value === 'number' ? Math.max(0, Math.min(maximum, value)) : fallback
  }
  const initialStatus = saved && ['ready', 'fuel', 'playing', 'won', 'over'].includes(String(savedState.status)) ? String(savedState.status) : 'ready'
  const initial = {
    status: initialStatus,
    distance: savedNumber('distance', 0, 1600),
    score: savedNumber('score', 0),
    energy: savedNumber('energy', 0, 5),
    lives: savedNumber('lives', 5, 5),
    time: savedNumber('timeLeft', 180, 180),
    questionIndex: savedNumber('questionIndex', 0, game.questions.length - 1),
    obstacleIndex: savedNumber('obstacleIndex', 0, 7),
  }
  const [questionOrder] = useState(() => {
    if (saved && typeof savedState.questionOrder === 'string') {
      const order = savedState.questionOrder.split(',').map(Number)
      if (order.length === game.questions.length && new Set(order).size === game.questions.length && order.every((index) => Number.isInteger(index) && index >= 0 && index < game.questions.length)) return order
    }
    return shuffleIndexes(game.questions.length)
  })
  const [status, setStatus] = useState(initial.status)
  const [distance, setDistance] = useState(initial.distance)
  const [score, setScore] = useState(initial.score)
  const [energy, setEnergy] = useState(initial.energy)
  const [lives, setLives] = useState(initial.lives)
  const [timeLeft, setTimeLeft] = useState(initial.time)
  const [questionIndex, setQuestionIndex] = useState(initial.questionIndex)
  const [obstacleIndex, setObstacleIndex] = useState(initial.obstacleIndex)
  const [jumpedObstacleIndex, setJumpedObstacleIndex] = useState(-1)
  const [choice, setChoice] = useState<number | null>(null)
  const [answerResult, setAnswerResult] = useState<boolean | null>(null)
  const [jumping, setJumping] = useState(false)
  const [message, setGameMessage] = useState('')
  const statusRef = useRef(initial.status)
  const distanceRef = useRef(initial.distance)
  const scoreRef = useRef(initial.score)
  const energyRef = useRef(initial.energy)
  const livesRef = useRef(initial.lives)
  const timeRef = useRef(initial.time)
  const questionIndexRef = useRef(initial.questionIndex)
  const obstacleIndexRef = useRef(initial.obstacleIndex)
  const jumpingRef = useRef(false)
  const jumpedObstacleRef = useRef(-1)
  const jumpUntilRef = useRef(0)
  const jumpCooldownRef = useRef(0)
  const question = game.questions[questionOrder[Math.min(questionIndex, game.questions.length - 1)]]
  const obstacleDistance = runnerObstacleDistances[obstacleIndex] ?? 1600
  const metersToObstacle = Math.max(0, obstacleDistance - distance)
  const hasJumpedForObstacle = jumpedObstacleIndex === obstacleIndex
  const jumpIsReady = status === 'playing' && metersToObstacle > 0 && metersToObstacle <= runnerJumpWindow && energy > 0 && !jumping && jumpedObstacleIndex !== obstacleIndex
  const canJump = jumpIsReady
  const progress = Math.min(distance / 1600, 1)
  const runner = game.id === 'barter' ? '🛵' : game.id === 'sort' ? '🐿️' : '🐷'
  const obstacle = game.id === 'barter' ? '📦' : game.id === 'sort' ? '🪵' : '🧸'

  const persist = useCallback((overrides: Partial<ActivityState> = {}) => onSaveProgress(game.id, {
    gameVersion,
    status: statusRef.current,
    distance: Math.round(distanceRef.current),
    score: scoreRef.current,
    energy: energyRef.current,
    lives: livesRef.current,
    timeLeft: Math.ceil(timeRef.current),
    questionIndex: questionIndexRef.current,
    obstacleIndex: obstacleIndexRef.current,
    questionOrder: questionOrder.join(','),
    ...overrides,
  }), [game.id, onSaveProgress, questionOrder])
  const persistRef = useRef(persist)
  useEffect(() => { persistRef.current = persist }, [persist])

  useEffect(() => {
    if (status !== 'playing') return
    let previousFrame = performance.now()
    let lastSave = previousFrame
    const timer = window.setInterval(() => {
      const now = performance.now()
      const delta = Math.min((now - previousFrame) / 1000, 0.1)
      previousFrame = now
      const remaining = Math.max(0, timeRef.current - delta)
      timeRef.current = remaining
      const nextDistance = Math.min(1600, distanceRef.current + delta * 26)
      distanceRef.current = nextDistance
      setDistance(nextDistance)
      setTimeLeft(remaining)
      if (now - lastSave > 4000) {
        lastSave = now
        persistRef.current()
      }
      if (nextDistance >= 1600) {
        statusRef.current = 'won'
        setStatus('won')
        persistRef.current({ status: 'won', distance: 1600 })
        return
      }
      if (obstacleIndexRef.current < runnerObstacleDistances.length && nextDistance >= runnerObstacleDistances[obstacleIndexRef.current]) {
        const clearedObstacle = jumpedObstacleRef.current === obstacleIndexRef.current
        const nextLives = clearedObstacle ? livesRef.current : Math.max(0, livesRef.current - 1)
        livesRef.current = nextLives
        obstacleIndexRef.current += 1
        jumpedObstacleRef.current = -1
        setLives(nextLives)
        setObstacleIndex(obstacleIndexRef.current)
        setJumpedObstacleIndex(-1)
        setGameMessage(clearedObstacle ? 'Nice jump! You cleared it!' : nextLives > 0 ? 'You bumped an obstacle. Watch for the next one!' : 'Out of hearts! Try another run.')
        if (nextLives === 0) {
          statusRef.current = 'over'
          setStatus('over')
          persistRef.current({ lives: nextLives, obstacleIndex: obstacleIndexRef.current, status: 'over' })
          return
        }
        persistRef.current({ lives: nextLives, obstacleIndex: obstacleIndexRef.current, status: statusRef.current })
      }
      if (now >= jumpUntilRef.current && jumpingRef.current) {
        jumpingRef.current = false
        setJumping(false)
      }
      if (remaining <= 0) {
        statusRef.current = 'over'
        setStatus('over')
        persistRef.current({ status: 'over', timeLeft: 0 })
        return
      }
      const nextQuestionCheckpoint = runnerQuestionCheckpoints[questionIndexRef.current - 1]
      if (nextQuestionCheckpoint !== undefined && nextDistance >= nextQuestionCheckpoint) {
        statusRef.current = 'fuel'
        setStatus('fuel')
        setChoice(null)
        setAnswerResult(null)
        persistRef.current({ status: 'fuel' })
      }
    }, 50)
    return () => window.clearInterval(timer)
  }, [status])

  useEffect(() => () => {
    if (statusRef.current === 'playing' || statusRef.current === 'fuel') persistRef.current()
  }, [])

  const begin = () => {
    if (statusRef.current !== 'ready') return
    statusRef.current = 'fuel'
    setStatus('fuel')
    setGameMessage('')
    persist({ status: 'fuel' })
  }

  const answerFuel = (answerIndex: number) => {
    if (answerResult === true) return
    setChoice(answerIndex)
    setAnswerResult(answerIndex === question.correct)
    if (answerIndex === question.correct) {
      const chargeReward = questionIndexRef.current === 0 ? 3 : 1
      const nextEnergy = Math.min(5, energyRef.current + chargeReward)
      const chargesAdded = nextEnergy - energyRef.current
      energyRef.current = nextEnergy
      scoreRef.current += 100
      setEnergy(nextEnergy)
      setScore(scoreRef.current)
      setGameMessage(`Great! +${chargesAdded} jump charges. ${question.explanation}`)
      persist({ energy: nextEnergy, score: scoreRef.current })
    } else {
      setGameMessage(`Try again! ${question.explanation}`)
    }
  }

  const continueFromFuel = () => {
    if (!answerResult) return
    const nextQuestion = Math.min(questionIndexRef.current + 1, game.questions.length - 1)
    questionIndexRef.current = nextQuestion
    statusRef.current = 'playing'
    setQuestionIndex(nextQuestion)
    setStatus('playing')
    setChoice(null)
    setAnswerResult(null)
    setGameMessage('')
    persist({ status: 'playing', questionIndex: nextQuestion })
  }

  const jump = useCallback(() => {
    const now = performance.now()
    if (statusRef.current !== 'playing' || jumpingRef.current || now < jumpCooldownRef.current) return
    const distanceToObstacle = (runnerObstacleDistances[obstacleIndexRef.current] ?? 1600) - distanceRef.current
    if (distanceToObstacle <= 0 || distanceToObstacle > runnerJumpWindow) return
    if (energyRef.current <= 0) {
      setGameMessage('No jump charges left. Keep going to the next question for a recharge.')
      return
    }
    energyRef.current -= 1
    jumpCooldownRef.current = now + 550
    jumpUntilRef.current = now + 1800
    jumpingRef.current = true
    jumpedObstacleRef.current = obstacleIndexRef.current
    setJumpedObstacleIndex(obstacleIndexRef.current)
    setJumping(true)
    setEnergy(energyRef.current)
    setGameMessage('')
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.code !== 'ArrowUp') return
      if (event.target instanceof HTMLElement && /INPUT|TEXTAREA|BUTTON|SELECT/.test(event.target.tagName)) return
      event.preventDefault()
      jump()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [jump])

  const replay = () => {
    distanceRef.current = 0
    scoreRef.current = 0
    energyRef.current = 0
    livesRef.current = 5
    timeRef.current = 180
    questionIndexRef.current = 0
    obstacleIndexRef.current = 0
    statusRef.current = 'ready'
    jumpingRef.current = false
    jumpedObstacleRef.current = -1
    setJumpedObstacleIndex(-1)
    setDistance(0)
    setScore(0)
    setEnergy(0)
    setLives(5)
    setTimeLeft(180)
    setQuestionIndex(0)
    setObstacleIndex(0)
    setStatus('ready')
    setChoice(null)
    setAnswerResult(null)
    setJumping(false)
    setGameMessage('')
    persist({ status: 'ready', distance: 0, score: 0, energy: 0, lives: 5, timeLeft: 180, questionIndex: 0, obstacleIndex: 0 })
  }

  if (status === 'won') return <section className="learning-page arcade-page arcade-result">
    <div className="arcade-trophy" aria-hidden="true">{game.id === 'barter' ? '🛵' : game.id === 'sort' ? '🌟' : '🐷'}</div>
    <p className="eyebrow-label">ARCADE FINISH · {game.title.toUpperCase()}</p>
    <h1>{done ? 'Your champion badge is waiting!' : 'You made it to the finish!'}</h1>
    <p>You ran <strong>1,600 meters</strong> and scored <strong>{score.toLocaleString()} points</strong>! Earn the <strong>{game.badge}</strong> badge for your trophy shelf.</p>
    <div className="arcade-reward-row"><span>⭐ {score.toLocaleString()} points</span><span>🏅 {game.badge}</span><span>🎁 XP + coins</span></div>
    <button className="primary-course-button" onClick={() => void onFinish()}>{done ? 'Continue learning →' : 'Collect my badge & rewards →'}</button>
  </section>

  if (status === 'over') return <section className="learning-page arcade-page arcade-result">
    <div className="arcade-trophy" aria-hidden="true">💫</div>
    <p className="eyebrow-label">RUN ENDED · {game.title.toUpperCase()}</p>
    <h1>Want another go?</h1>
    <p>You ran <strong>{Math.round(distance).toLocaleString()} meters</strong> and scored <strong>{score.toLocaleString()} points</strong>. Your badge is waiting at the finish.</p>
    <button className="primary-course-button" onClick={replay}>Run it back →</button>
  </section>

  return <section className="learning-page arcade-page runner-arcade">
    <div className="arcade-heading"><span aria-hidden="true">{game.emoji}</span><div><p className="eyebrow-label">ARCADE RUN · {game.title.toUpperCase()}</p><h1>{game.title}</h1><p>{game.subtitle}</p></div></div>
    {status === 'ready' && <div className="arcade-start-screen"><div className="arcade-start-art" aria-hidden="true">{runner}<span>✦</span></div><h2>Ready, set, dash!</h2><p>Answer questions to earn jump charges. Tap JUMP or press Space when an obstacle is close. You’ll get another question to recharge as you run.</p><div className="arcade-rules"><span>🏁 Run 1,600 meters</span><span>⚡ Questions earn charges</span><span>💛 5 hearts · 3 minutes</span></div><button className="primary-course-button" onClick={begin}>Charge up & play →</button></div>}
    {(status === 'fuel' || status === 'playing') && <div className="runner-hud">
      <div className="runner-hud-row">
        <div className="runner-stat"><small>🏁 DISTANCE</small><strong>{Math.round(distance).toLocaleString()} <span>/ 1,600 m</span></strong></div>
        <div className="runner-stat"><small>⏱ TIME</small><strong>{String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(Math.floor(timeLeft % 60)).padStart(2, '0')}</strong></div>
        <div className="runner-stat"><small>❤️ HEARTS</small><strong>{'❤️'.repeat(lives)}<span>{'🖤'.repeat(5 - lives)}</span></strong></div>
        <div className="runner-stat"><small>🏆 SCORE</small><strong>{score.toLocaleString()}</strong></div>
      </div>
      <div className="runner-progress" role="progressbar" aria-label="Distance to finish" aria-valuemin={0} aria-valuemax={1600} aria-valuenow={Math.round(distance)}><i style={{ width: `${progress * 100}%` }} /></div>
      <div className="runner-charge-panel">
        <div><strong>⚡ JUMP CHARGES · {energy}/5</strong><span>Spend 1 per jump · answer questions for +1</span></div>
        <div className="runner-charge-pips" aria-label={`${energy} jump charges`}>
          {Array.from({ length: 5 }, (_, index) => <span key={index} className={index < energy ? 'charged' : ''}>⚡</span>)}
        </div>
      </div>
      {status === 'fuel' ? <div className="runner-fuel-card">
        <span className="runner-fuel-icon" aria-hidden="true">⚡</span><p className="eyebrow-label">{questionIndex === 0 ? 'FIRST ENERGY BOOST' : 'CHECKPOINT ENERGY BOOST'}</p>
        <h2>{question.prompt}</h2><p>{question.detail}</p>
        <div className="runner-fuel-answers">{question.answers.map((answerText, answerIndex) => <button key={answerText} disabled={answerResult === true} className={choice === answerIndex ? answerResult ? 'fuel-right' : 'fuel-wrong' : ''} onClick={() => answerFuel(answerIndex)}>{answerText}</button>)}</div>
        {answerResult !== null && <p className={answerResult ? 'runner-answer-note good' : 'runner-answer-note'} role="status">{message}</p>}
        {answerResult && <button className="primary-course-button" onClick={continueFromFuel}>Power up + keep running →</button>}
      </div> : <>
        <div className={`runner-scene runner-scene-${game.id} ${jumpIsReady ? 'jump-ready' : ''}`}>
          <div className="runner-sky"><span className="runner-sun" aria-hidden="true">☀️</span><span className="runner-cloud cloud-one" aria-hidden="true">☁️</span><span className="runner-cloud cloud-two" aria-hidden="true">☁️</span></div>
          <div className="runner-scene-level">LEVEL {Math.min(3, Math.floor(distance / 540) + 1)}</div>
          <div className={`runner-character ${jumping ? 'is-jumping' : ''}`} aria-label={runner}>{runner}</div>
          {obstacleIndex < runnerObstacleDistances.length && <div className="runner-obstacle" style={{ left: `${Math.max(22, Math.min(90, 22 + (metersToObstacle / 180) * 65))}%` }} aria-hidden="true">{obstacle}</div>}
          <div className="runner-ground"><span className="runner-track-dashes" aria-hidden="true" /></div>
        </div>
        <div className="runner-controls">
          <div className={`runner-obstacle-status ${jumpIsReady ? 'ready' : ''}`} role="status">
            {obstacleIndex >= runnerObstacleDistances.length ? 'Clear road — keep running!' : jumpIsReady ? 'Obstacle close — jump now!' : hasJumpedForObstacle ? 'Nice jump! Keep running.' : metersToObstacle <= runnerJumpWindow && energy === 0 ? 'No jump charges — run to the next question to recharge.' : `Next obstacle: ${Math.ceil(metersToObstacle)} m away`}
          </div>
          <button className="runner-jump-button" onClick={jump} disabled={!canJump} aria-keyshortcuts="Space">
            {jumping ? '⬆ JUMPING!' : jumpIsReady ? '⚡ JUMP NOW' : hasJumpedForObstacle ? 'NICE JUMP!' : energy === 0 ? 'NEED CHARGE' : 'WAIT FOR OBSTACLE'}
          </button>
          <p>Press <kbd>SPACE</kbd> or tap JUMP when the obstacle gets close.</p>
        </div>
        {message && <p className="runner-feedback" role="status">{message}</p>}
      </>}
    </div>}
  </section>
}

function Review({ onFinish }: { onFinish: () => void }) { const cards = [['💰', 'Money', 'Helps us buy goods and services.'], ['🤝', 'Bartering', 'Trading one item for another.'], ['📦', 'Goods', 'Things you can touch.'], ['🧑‍🏫', 'Services', 'Work people do to help.'], ['❤️', 'Needs', 'Things we must have.'], ['⭐', 'Wants', 'Things we would like to have.']]; return <section className="learning-page review-page"><p className="eyebrow-label">CHAPTER REVIEW · 5–7 MINUTES</p><h1>Let’s remember what we learned!</h1><Penny>You have learned so much already. Read the cards, then take the chapter quiz when you feel ready.</Penny><div className="memory-grid">{cards.map(([icon, title, text]) => <article key={title}><span>{icon}</span><h2>{title}</h2><p>{text}</p></article>)}</div><section className="real-life"><h2>Real-life challenge</h2><p>Look around your home. Can you find three goods, one service someone did today, two needs, and two wants?</p></section><button className="primary-course-button" onClick={() => onFinish()}>I am ready for the quiz →</button></section> }

function SavingsProject({ savedGoal, savedState, onSaveProgress, onFinish }: { savedGoal?: { goal: string; plan: string } | null; savedState?: ActivityState; onSaveProgress: (activityId: string, progress: ActivityState) => void; onFinish: (activity: ActivityProgress) => void }) {
  const [goal, setGoal] = useState(typeof savedState?.goal === 'string' ? savedState.goal : savedGoal?.goal ?? '')
  const [plan, setPlan] = useState(typeof savedState?.plan === 'string' ? savedState.plan : savedGoal?.plan ?? '')
  return <section className="learning-page project-page">
    <p className="eyebrow-label">FINAL PROJECT · SAVINGS GOAL</p>
    <h1>Create your own savings goal</h1>
    <Penny>Saving means keeping some money for later. Give your money a job!</Penny>
    <label>Something I want to save for<input value={goal} maxLength={100} onChange={(event) => setGoal(event.target.value)} onBlur={() => onSaveProgress('final-project', { goal, plan })} placeholder="For example: a new book" /></label>
    <label>My plan for saving<textarea value={plan} maxLength={500} onChange={(event) => setPlan(event.target.value)} onBlur={() => onSaveProgress('final-project', { goal, plan })} placeholder="I can save by…" /></label>
    <button className="primary-course-button" disabled={!goal.trim() || !plan.trim()} onClick={() => onFinish({ id: 'final-project', xp: 25, coins: 10, goal: goal.trim(), plan: plan.trim() })}>{savedGoal ? 'Save my goal' : 'Finish my project'} →</button>
  </section>
}

function Completion({ learnerName, xp, coins }: { learnerName: string; xp: number; coins: number }) { return <section className="completion-page"><div className="confetti">✦ ✦ ★ ✦ ✦</div><div className="completion-badge">🏅<span>Money<br />Explorer</span></div><p>CHAPTER 1 COMPLETE</p><h1>Congratulations, {learnerName}!</h1><h2>You are officially a Money Explorer.</h2><span>You learned what money is, how bartering works, goods and services, and how to put needs before wants.</span><div className="completion-rewards"><div><strong>{xp}</strong><span>Total XP</span></div><div><strong>{coins}</strong><span>NextGen coins</span></div><div><strong>1 / 5</strong><span>Grade 1 chapters</span></div></div><section><p>UP NEXT</p><h2>Chapter 2: Coins & Bills</h2><span>Learn about coins, dollar bills, counting money, and making simple purchases.</span><button disabled>Chapter 2 coming soon</button></section></section> }